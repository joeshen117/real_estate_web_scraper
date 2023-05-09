const fs = require('fs')
const $ = require('cheerio')

// Open local html
var data = fs.readFileSync(`sample.html`, 'utf-8')
const $scripts = $('script', data).toArray()
const dataFiled = $scripts.filter((v) => {
  return $(v)
    .html()
    .includes('NGRX')
})
data = $(dataFiled[0]).html()
data = data.replace(/&q;/g, '"')
var regionOBJ = JSON.parse(data)
const regionInfo = Object.entries(regionOBJ.NGRX_STATE.location.localities.item)
regionOBJ = regionOBJ.NGRX_STATE.location.localities.item

//Debugging
// fs.writeFileSync('regionInfo.json', JSON.stringify(regionInfo))

//Making data
var suburbs = []
var districts = []
var regions = []
var addressList = []
for ([key, value] of regionInfo) {
  switch (key.replace(/-\d*/g, '')) {
    case 'suburb':
      //   console.log('suburb', value.name)
      suburbs.push(value.name)
      var district = regionOBJ[value.parentKey]
      //   console.log(district.name)
      var region = regionOBJ[district.parentKey]
      //   console.log(region.name)
      addressList.push(`${value.name}, ${district.name}, ${region.name}`)
      break
    case 'district':
      //   console.log('district', value.name)
      districts.push(value.name)
      break
    case 'region':
      //   //   console.log('region', value.name)
      regions.push(value.name)
      break
  }
}
// console.log(suburbs, districts, regions)
// console.log(addressList)

const regionData = {
  suburbs,
  districts,
  regions,
  addressList,
}
// console.log(regionData)

console.log(JSON.stringify(regionData))
