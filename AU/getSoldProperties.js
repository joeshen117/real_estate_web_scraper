const $ = require('cheerio')
const { origRp } = require('../helper_script/rp.helper')

module.exports.getSoldProperties = (data) => {
  const $scripts = $('script', data).toArray()
  let dataField = null
  $scripts.forEach((val) => {
    const content = $(val).html()
    if (content.includes('window.__APOLLO_STATE__')) {
      dataField = content
    }
  })

  //Downside selector
  let agents = dataField.replace(/window./g, '')
  agents = agents.split(/;\s*__APP_CONFIG__/)
  agents = agents[0]
  agents = agents.replace('__APOLLO_STATE__=', '')
  const dataObj = JSON.parse(agents)

  //Get sold properties list
  const soldProperties = Object.entries(dataObj)
    .filter((val) => val[0].match(/^\$ResidentialListing\S*links.canonical$/g))
    .map((val) => val[1].href)
    .filter((val) => val.includes('sold'))
  // console.log(soldProperties)
  // console.log(soldProperties.length)
  return soldProperties
}
