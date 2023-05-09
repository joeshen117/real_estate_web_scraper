// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)
// import '@tensorflow/tfjs-node';
require('@tensorflow/tfjs-node')

// implements nodejs wrappers for HTMLCanvasElement, HTMLImageElement, ImageData
const canvas = require('canvas')

const faceapi = require('face-api.js')

const stringify = require('csv-stringify')
const _ = require('lodash')
const $ = require('cheerio')
const { filter, each } = require('lodash')
const parse = require('date-fns/parse')
const { getTextFrom, getAttrFrom, doesFindFrom } = require('../helper_script/cheerio.helper')
const { origRp, scraperRp } = require('../helper_script/rp.helper')
const stringifier = stringify({ header: true })

// patch nodejs environment, we need to provide an implementation of
// HTMLCanvasElement and HTMLImageElement, additionally an implementation
// of ImageData is required, in case you want to use the MTCNN
const { Canvas, Image, ImageData } = canvas
faceapi.env.monkeyPatch({ Canvas, Image, ImageData })

//Import JSON file.
const data = require('./salesPeople.json')

//Stringfy buffer
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
  //   console.log('')
})

const getSalespersonFromUrl = (data) => {
  //   const data = await origRp({ method: 'GET', url })

  //Contact phone
  let mobilePhone = $($('.contact-number-mobile', data).toArray()[0]).text()
  mobilePhone = mobilePhone.replace(/e\s*/g, '-')
  mobilePhone = mobilePhone.replace(/\s/g, '')

  //PersonalInfo
  const getText = getTextFrom($('.profile-about', data))
  const forSale = getText('[data-test-attr="prop-link-Properties"] em')
  const soldRecently = getText('[data-test-attr="prop-link-Sold"] em')

  return {
    mobilePhone,
    forSale,
    // soldRecently,
  }
}

const getSalesPropertyFromUrl = (data, name) => {
  const $scripts = $('script', data).toArray()
  let dataField = null
  $scripts.forEach((val) => {
    const content = $(val).html()
    if (content.includes("angular.module('barfootWeb').value('profileTabData'")) {
      dataField = val
    }
  })

  //Processing script tag
  dataField = dataField.firstChild.data.replace("angular.module('barfootWeb').value('profileTabData', ", '')
  dataField = dataField.replace(/^\s*/g, '')
  dataField = dataField.replace(/\s*$/g, '')
  dataField = dataField.substring(0, dataField.length - 2)
  dataField = JSON.parse(dataField)
  dataField = dataField.filter((d) => {
    return d.Label == 'Sold recently'
  })

  // Data that can be collected:
  // - marketedVolume: number of listings marketed last year (vendors)
  // - coMarketedVolume: number of listings marketed last year with another agent (as a team/with collaborator)
  // - coMarketedAgents: number of unique agents co-marketed with last year (1-2 means team, more means collaborator)
  // - marketedSoldVolume: number of listings marketed and sold last year
  // - soldVolume: number of listings sold last year (buyers)
  // - coSoldVolume: number of listings sold last year with another agent

  // Data to collect for now:
  // - marketedVolume: number of listings marketed last year (vendors)
  // - coMarketedVolume: number of listings marketed last year with another agent (as a team/with collaborator)
  // - marketedSoldVolume: number of listings marketed and sold last year
  // - soldVolume: number of listings sold last year (buyers)
  // Metrics that can be computed from these data
  // - vendor volume: marketedVolume
  // - single vendor volume: marketedVolume - coMarketedVolume
  // - vendor score: marketedVolume / (marketedVolume + soldVolume - marketedSoldVolume)
  // - single score: (marketedVolume - coMarketedVolume) / marketedVolume

  const properties = dataField[0].Items
  const propertiesLastYear = _.filter(properties, (o) =>
    _.includes(
      [
        'July 2018',
        'August 2018',
        'September 2018',
        'October 2018',
        'November 2018',
        'December 2018',
        'January 2019',
        'February 2019',
        'March 2019',
        'April 2019',
        'May 2019',
        'June 2019',
      ],
      o.SoldDate
    )
  )

  const marketedPropertiesLastYear = _.filter(
    propertiesLastYear,
    (o) =>
      (o.MarketedByAgent1 && o.MarketedByAgent1.AgentName == name) ||
      (o.MarketedByAgent2 && o.MarketedByAgent2.AgentName == name)
  )
  const marketedVolume = marketedPropertiesLastYear.length

  const coMarketedPropertiesLastYear = _.filter(
    marketedPropertiesLastYear,
    (o) => o.MarketedByAgent1 && o.MarketedByAgent2
  )
  const coMarketedVolume = coMarketedPropertiesLastYear.length

  const soldPropertiesLastYear = _.filter(
    propertiesLastYear,
    (o) => (o.SoldByAgent1 && o.SoldByAgent1.AgentName == name) || (o.SoldByAgent2 && o.SoldByAgent2.AgentName == name)
  )
  const soldVolume = soldPropertiesLastYear.length

  const marketedSoldPropertiesLastYear = _.filter(
    propertiesLastYear,
    (o) =>
      ((o.MarketedByAgent1 && o.MarketedByAgent1.AgentName == name) ||
        (o.MarketedByAgent2 && o.MarketedByAgent2.AgentName == name)) &&
      ((o.SoldByAgent1 && o.SoldByAgent1.AgentName == name) || (o.SoldByAgent2 && o.SoldByAgent2.AgentName == name))
  )
  const marketedSoldVolume = marketedSoldPropertiesLastYear.length

  return {
    marketedVolume,
    coMarketedVolume,
    soldVolume,
    marketedSoldVolume,
  }
}

;(async () => {
  // Load face recognition nets
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./weights')
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./weights')
  await faceapi.nets.ageGenderNet.loadFromDisk('./weights')
  let errorNum = 0
  for (const staffMember of data) {
    try {
      const id = staffMember.UserId
      const name = staffMember.DisplayName
      const branch = staffMember.BranchName
      const photo = staffMember.Photo
      const title = staffMember.Title
      const url = `https://www.barfoot.co.nz/our-people/${staffMember.UserId}`
      console.error(url)
      const data = await origRp({ method: 'GET', url })
      const staffMemberBasicInfo = getSalespersonFromUrl(data)
      var propertyInfo
      try {
        propertyInfo = getSalesPropertyFromUrl(data, name)
      } catch (e) {
        propertyInfo = {
          marketedVolume: 0,
          coMarketedVolume: 0,
          soldVolume: 0,
          marketedSoldVolume: 0,
        }
      }
      const img = await canvas.loadImage(photo)
      const result = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withAgeAndGender()

      //Aggregate information
      const staffMemberInfo = {
        id,
        name,
        branch,
        title,
        ...staffMemberBasicInfo,
        ...propertyInfo,
        age: result.age,
        gender: result.gender,
        url,
      }
      // console.error(staffMemberInfo)
      stringifier.write(staffMemberInfo)
    } catch (e) {
      console.error(e)
      errorNum++
      console.error(`Error occured ${errorNum} times`)
      continue
    }
  }
  stringifier.end()
})()
