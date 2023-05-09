const { origRp, scraperRp } = require('../helper_script/rp.helper')

;(async () => {
  let page = 1
  let salesPeople = []
  try {
    while (true) {
      url = `https://www.barfoot.co.nz/api/staff/get?querytype=Agents&page=${page}&pagesize=48&departments=RES|RUR&branchApiRef=0&name=&excludedTitles=`
      const data = await origRp({ method: 'GET', url })
      console.error(data.length)
      console.error(page)
      if (data.length === 0) {
        throw e
      } else {
        dataObj = JSON.parse(data)
        // console.log(dataObj)
        dataObj.forEach((element) => {
          salesPeople.push(element)
          //   console.log('666')
        })
        // console.log('666')
      }
      page++
    }
  } catch (e) {
    const salesPeopleJSON = JSON.stringify(salesPeople)
    console.log(salesPeopleJSON)
  }
})()
