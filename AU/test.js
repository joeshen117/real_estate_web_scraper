const stringify = require('csv-stringify')
const $ = require('cheerio')
const { getTextFrom, getAttrFrom, doesFindFrom } = require('../helper_script/cheerio.helper')
const { origRp } = require('../helper_script/rp.helper')
const stringifier = stringify({ header: true })
const { getID } = require('./getID')
const { getPersonData } = require('./getSalesNumber')

// Testing script
;(async () => {
  try {
    const url = `https://www.realestate.com.au/agent/james-mccormack-76317`
    const data = await getPersonData('James McCormack', url)
    console.log(data)
  } catch (e) {
    console.error(e)
  }
})()
