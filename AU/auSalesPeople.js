const stringify = require('csv-stringify')
const $ = require('cheerio')
const { getTextFrom, getAttrFrom, doesFindFrom } = require('../helper_script/cheerio.helper')
const { origRp } = require('../helper_script/rp.helper')
const stringifier = stringify({ header: true })
const { getID } = require('./getID')
const { getPersonData } = require('./getPersonData')

async function sleep(milliseconds) {
  console.error('Sleeping...')
  var start = new Date().getTime()
  for (var i = 0; i < 1e7; i++) {
    if (new Date().getTime() - start > milliseconds) {
      console.error('Waking...')
      break
    }
  }
}

stringifier.on('readable', () => {
  let row
  while ((row = stringifier.read())) {
    process.stdout.write(row)
  }
})
stringifier.on('error', (err) => {
  console.error('error', err.message)
})
stringifier.on('finish', () => {
  console.log('')
})

const createPostcodeArray = (min, max) =>
  Array(max - min)
    .fill(min)
    .map((value, index) => {
      const postcode = (value + index).toString()
      return postcode.length === 4 ? postcode : `0${postcode}`
    })

const postcodes = {
  NSW: createPostcodeArray(2000, 2600),
  //ACT: createPostcodeArray(2600, 3000),
  //VIC: createPostcodeArray(3000, 4000),
  //QLD: createPostcodeArray(4000, 4896),
  //SA: createPostcodeArray(5000, 5800),
  //WA: createPostcodeArray(6000, 6798),
  //TAS: createPostcodeArray(7000, 7471),
  //NT: createPostcodeArray(800, 887),
}

//Testing page
// const postcodes = {
//   QLD: createPostcodeArray(4000, 4896),
// }

const propertyTypes = [
  'HOUSE',
  // 'UNIT_APARTMENT',
  // 'LAND',
  // 'TOWNHOUSE',
  // 'RURAL',
  // 'VILLA',
  // 'ACREAGE',
  // 'UNITBLOCK',
  // 'RETIRE',
]

const parseAgentDetails = (propType, profile) => {
  const getText = getTextFrom($(profile))
  const getAttr = getAttrFrom($(profile))

  const name = getText('.agent-profile__name')
  const agency = getText('.agent-profile__agency')
  const role = getText('.agent-profile__role')
  const experience = getText('.agent-profile__experience')
  const rating = getText('.RatingAggregate__AggregatedValue-sc-1kwk0xl-1.knpBtg') || ''
  const numOfReviews =
    (rating && getText('.RatingAggregate__NumberOfReviews-sc-1kwk0xl-3.dDQPIg').replace(/\D/g, '')) || ''
  const stats = getText('.key-feature__value')
  const getIndex = (char) => stats.indexOf(char)
  const propertySalesAsLeadAgent = getIndex('$') !== -1 ? stats.split('$')[0] : stats.split('—')[0]
  const medianSoldPrice =
    getIndex('$') !== -1
      ? stats.substring(getIndex('$'), getIndex('m') !== -1 ? getIndex('m') + 1 : getIndex('k') + 1)
      : 'insufficient data'
  const medianDaysAdvertised = getText('.key-feature__value span').replace(/\D/g, '')
  // const totalPropertySales = getText('.key-feature__value')
  // console.log(region)
  return {
    name,
    agency,
    role,
    experience,
    propType,
    rating,
    numOfReviews,
    propertySalesAsLeadAgent,
    medianSoldPrice,
    medianDaysAdvertised,
  }
}

const getAgentCity = async (postcode) => {
  const url = `https://postcodes-australia.com/postcodes/${postcode}`
  const data = await origRp({ method: 'GET', url })

  const $locationDetails = $('#content', data)
  const getText = getTextFrom($($locationDetails))
  const city = getText('h1')
    .split('(')
    .pop()
    .trim()
    .replace(/\)/, '')
  return city
}

const getPageNum = (data) => {
  const $pageNum = $('div.pagination', data)
  const getText = getTextFrom($($pageNum))
  return parseInt(
    getText('div.PaginationBar')
      .split(' ')
      .pop()
  )
}

//Agetns ID records to avoid duplictes
let agentsRecord = []

const getAgentsByPostcodePropType = async (postcode, propType, state) => {
  let currPageNum = 1
  const agents = []
  try {
    const url = `https://www.realestate.com.au/find-agent/agents/${postcode}?source=results&propertyType=${propType}&page=${currPageNum}`
    const data = await origRp({ method: 'GET', url })
    const city = await getAgentCity(postcode)
    const pageNum = getPageNum(data)
    while (currPageNum <= pageNum) {
      await sleep(2000)
      const url = `https://www.realestate.com.au/find-agent/agents/${postcode}?source=results&propertyType=${propType}&page=${currPageNum}`
      const data1 = await origRp({ method: 'GET', url })
      const scriptData = await getID(data1)
      const $agentDetails = $('.agent-card__details', data1)

      //Processing cards and fetch properties
      for (let i = 0; i < $agentDetails.length; i++) {
        const profile = $agentDetails[i]
        const agent = parseAgentDetails(propType, profile)
        const name = agent.name
        const personData = scriptData[name]
        const currentID = personData[0]

        //Check if agent already fetched
        if (!agentsRecord.includes(currentID)) {
          await sleep(2000)
          const totalSales_InOneYear = personData[1]
          const agentURL = personData[2]
          console.error(agentURL)
          const salesData = await getPersonData(name, agentURL)

          // Debugging purpose
          // console.log(currentID, totalSales_InOneYear, agentURL, averageAgentsPerProperty)

          agents.push({ city, state, postcode, ...agent, totalSales_InOneYear, ...salesData, agentURL })
          agentsRecord.push(currentID)
        }
      }
      currPageNum++
    }
  } catch (e) {
    console.error(e)
  }
  agents.forEach((agent) => stringifier.write(agent))
}

;(async () => {
  for (let state of Object.keys(postcodes)) {
    for (let postcode of postcodes[state]) {
      for (let type of propertyTypes) {
        try {
          console.error(`${state} ${postcode} ${type}`)
          await getAgentsByPostcodePropType(postcode, type, state)
        } catch (e) {
          console.error(`Error occured at${state} ${postcode} ${type}`)
          continue
        }
      }
    }
  }
  stringifier.end()
  console.error('Finished')
})()
