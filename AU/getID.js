const $ = require('cheerio')

module.exports.getID = async (data) => {
  try {
    //Script selector
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
    const scriptObject = JSON.parse(agents)
    let agentsWrapper = []
    for (var i in scriptObject) {
      if (i.includes('Agent:' || 'PowerAgent:') && !i.includes('$')) {
        let agent = scriptObject[i]
        //formatting url
        const url = agent.url

        agentsWrapper[agent.name] = [agent.id, agent.totalSalesAcrossAllSuburbs, `https://www.realestate.com.au${url}`]
      }
    }
    return agentsWrapper
  } catch (e) {
    console.error('Error occured in getID')
    return e
  }
}
