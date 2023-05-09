const $ = require('cheerio')
const { origRp } = require('../helper_script/rp.helper')
const { getSoldProperties } = require('./getSoldProperties')

// import nodejs bindings to native tensorflow,
// not required, but will speed up things drastically (python required)
// import '@tensorflow/tfjs-node';
require('@tensorflow/tfjs-node')

// implements nodejs wrappers for HTMLCanvasElement, HTMLImageElement, ImageData
const canvas = require('canvas')
const faceapi = require('face-api.js')
const { Canvas, Image, ImageData } = canvas
faceapi.env.monkeyPatch({ Canvas, Image, ImageData })

const getSalespeopleNumber = async (name, url) => {
  const data = await origRp({ method: 'GET', url })
  const $agentLister = $('.lister', data).toArray()
  const agentNames = $agentLister.map((val) => $('.lister__name', val).text())
  //Processing
  var marketedVolume = 0
  var coMarketVolume = 0
  var soldVolume = 0
  //If agent not shown in the property increase sales volume
  if (!agentNames.includes(name)) {
    soldVolume += 1

    //If agent showed and is the only one included, only increase sales volume
  } else if (agentNames.length == 1) {
    marketedVolume += 1

    //If mutiple agetns included, increase both marketed and co-marked volume
  } else {
    marketedVolume += 1
    coMarketVolume += 1
  }

  return {
    marketedVolume,
    coMarketVolume,
    soldVolume,
    salespeopleNumber: $agentLister.length,
    agentNames,
  }
}

const getPhotoInfo = async (data) => {
  //Processing data to acquire url
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('./weights')
  await faceapi.nets.faceLandmark68Net.loadFromDisk('./weights')
  await faceapi.nets.ageGenderNet.loadFromDisk('./weights')

  let photoUrl = $($('.standard-agent__hero-avatar', data).html()).attr('style')
  if (!photoUrl) photoUrl = $($('.hero-avatar__inner', data).html()).attr('style')
  var photo = photoUrl.replace(/^\S*url\(/, '')
  photo = photo.slice(0, photo.length - 1)
  const url = 'http:' + photo

  //Getting gender and age
  const img = await canvas.loadImage(url)
  const result = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withAgeAndGender()
  return {
    gender: result.gender,
    age: result.age,
  }
}

module.exports.getPersonData = async (name, url) => {
  try {
    //Getting info
    const data = await origRp({ method: 'GET', url })
    const photoInfo = await getPhotoInfo(data)

    const $soldProperty = getSoldProperties(data)
    let propertyNumber = $soldProperty.length

    //Null agent check
    if (propertyNumber == 0) {
      return {
        marketedVolume: 0,
        coMarketVolume: 0,
        soldVolume: 0,
        averageAgentPerProerty: 0,
        uniqueAgents: 0,
        ...photoInfo,
      }
    }

    //Else if go through each property to check sales number
    var totalNumber = 0
    var marketedVolume = 0
    var coMarketVolume = 0
    var soldVolume = 0
    var uniqueAgentsList = []
    for (property of $soldProperty) {
      let number = await getSalespeopleNumber(name, property)
      totalNumber += number.salespeopleNumber
      marketedVolume += number.marketedVolume
      coMarketVolume += number.coMarketVolume
      soldVolume += number.soldVolume
      uniqueAgentsList = uniqueAgentsList.concat(number.agentNames)
    }
    const averageAgentPerProerty = totalNumber / propertyNumber

    uniqueAgentsList = [...new Set(uniqueAgentsList)]
    const uniqueAgents = uniqueAgentsList.length
    return {
      marketedVolume,
      coMarketVolume,
      soldVolume,
      averageAgentPerProerty,
      uniqueAgents,
      ...photoInfo,
    }
  } catch (e) {
    console.error(e)
    return 'Error processing properties'
  }
}
