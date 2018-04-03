#!/usr/bin/env node
const fs = require('fs') // eslint-disable-line
const chalk = require('chalk')
const emoji = require('node-emoji')
const fuzzy = require('fuzzy')
const inquirer = require('inquirer')
const fetch = require('node-fetch')

// config
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

// globals
const ghUrl = 'https://api.github.com/'
const ghHeaders = new fetch.Headers({
  'Content-type': 'application/json',
  'Authorization': `token ${readGithubToken()}`,
})

const reposUrls = new Map()
const milestonesUrls = new Map()
let chosenRepo = null
let reposNames = null


///////////////
// Listeners //
///////////////

// node listeners
process.on('uncaughtException', err => {
  console.log(chalk.red(`${emoji.get('broken_heart')} something went wrong! it's not you, it's me`))
  console.log(chalk.red(`${emoji.get('sos')} ${err.message}`))
  console.log(chalk.red(`${emoji.get('sos')} ${err.stack}`))
})

process.on('unhandledRejection', (reason, promise) => {
  console.log(chalk.yellow(`${emoji.get('construction')} ${String(reason).replace('Error:', 'Warning:')}`))
})


/////////////
// Helpers //
/////////////

const parsers = {

  milestoneIssues: issues => {
    const parsedIssues = []
    const splittedIssues = {
      bug: [],
      feature: [],
      upkeep: [],
    }

    issues.forEach(i => {
      parsedIssues.push({
        number: i.number,
        url: i.url,
        title: i.title,
        creator: i.user.login,
        labels: parsers.labels(i.labels),
        created_at: i.created_at,
        updated_at: i.updated_at,
        closed_at: i.closed_at,
      })
    })

    parsedIssues.forEach(i => {
      if (i.labels.has('k.bug')) splittedIssues.bug.push(i)
      if (i.labels.has('k.feature')) splittedIssues.feature.push(i)
      if (i.labels.has('k.upkeep')) splittedIssues.upkeep.push(i)
    })

    return splittedIssues
  },

  milestone: ms => {
    return {
      description: ms.description,
      url: ms.url,
      title: ms.title,
      number: ms.number,
      creator: ms.creator.login,
      open_issues: ms.open_issues,
      closed_issues: ms.closed_issues,
      created_at: ms.created_at,
      updated_at: ms.updated_at,
      due_on: ms.due_on,
      closed_at: ms.closed_at,
    }
  },

  labels: labels => {
    const allowedLabels = new Set([
      'k.feature',
      'k.bug',
      'k.upkeep',
      'x.firebase',
    ])
    labels = labels.filter(l => allowedLabels.has(l.name))
    return new Set(labels.map(l => l.name))
  },
}

function readGithubToken() {
  const token = fs.readFileSync('.github-token', 'utf8')
  return token.replace('\n', '')
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max))
}

async function searchRepoNames(answers, input) {
  const repos = reposNames || await fetchRepoNames(ghUrl, ghHeaders)
  return new Promise(resolve => {
    setTimeout(() => {
      const fuzzyResult = fuzzy.filter(input || '', repos)
      resolve(fuzzyResult.map(element => {
        return element.original
      }))
    }, getRandomInt(300))
  })
}

function formatResults(ms, issues) {
  const bugIssues = issues.bug
  const featureIssues = issues.feature
  const upkeepIssues = issues.upkeep
  const dueDate = ms.due_on ? new Date(ms.due_on).toUTCString() : null
  const createDate = ms.created_at ? new Date(ms.created_at).toUTCString() : null
  const closedDate = ms.closed_at ? new Date(ms.closed_at).toUTCString() : null
  let md = `
  ---

  ### Milestone [${ms.title}](${ms.url})
  _${ms.description}_


  Due on: ${dueDate}
  Closed on: ${closedDate}
  Created on: ${createDate}
  Issues nb: ${ms.open_issues + ms.closed_issues}

  `
  md += '\n'

  // bugs
  md += `### Bugs (${bugIssues.length})\n`
  bugIssues.forEach(i => {
    md += `- #${i.number} ${i.title} \`${[...i.labels]}\`\n`
  })
  md += '\n\n'

  // features
  md += `### Features (${featureIssues.length})\n`
  featureIssues.forEach(i => {
    md += `- #${i.number} ${i.title} \`${[...i.labels]}\`\n`
  })
  md += '\n\n'

  // upkeep
  md += `### Upkeep (${upkeepIssues.length})\n`
  upkeepIssues.forEach(i => {
    md += `- #${i.number} ${i.title} \`${[...i.labels]}\`\n`
  })
  md += '\n\n'

  return md
}

async function fetchUserRepos(url, headers) {
  const repos = []
  let body

  try {
    const res = await fetch(url + 'user/repos', {headers})
    body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchUserRepos ${body.message}`)
  } catch (e) {
    throw e
  }

  body.forEach(repo => {
    reposUrls.set(repo.name, repo.url)
    repos.push(repo.name)
  })

  return repos
}

async function fetchOrgsRepos(url, headers) {
  const repos = []
  let urls = []

  try {
    const resOrgs = await fetch(url + 'user/orgs', {headers})
    const bodyOrgs = await resOrgs.json()

    if (resOrgs.status !== 200)
      throw new Error(`fetchOrgsRepos ${bodyOrgs.message}`)
    else
      urls = bodyOrgs.map(o => o.repos_url)

    for (url of urls) {
      const res = await fetch(url, {headers})
      const body = await res.json()
      body.forEach(repo => {
        reposUrls.set(repo.name, repo.url)
        repos.push(repo.name)
      })
    }
  } catch (e) {
    throw e
  }
  return repos
}

async function fetchRepoNames(url, headers) {
  let allRepos = []
  let userRepos = []
  let orgsRepos = []

  try {
    userRepos = await fetchUserRepos(url, headers)
    orgsRepos = await fetchOrgsRepos(url, headers)
    allRepos = allRepos.concat(userRepos, orgsRepos)
  } catch (e) {
    throw e
  }
  reposNames = allRepos.sort()
  return allRepos.sort()
}

async function fetchMilestoneNames(url, headers) {
  const names = []
  let body

  try {
    const res = await fetch(url + '/milestones', {headers})
    body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchMilestoneNames ${body.message}`)
  } catch (e) {
    throw e
  }

  body.forEach(ms => {
    milestonesUrls.set(ms.title, ms.url)
    names.push(ms.title)
  })

  return names
}

async function fetchMilestoneInfo(url, headers) {
  let body

  try {
    const res = await fetch(url, {headers})
    body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchMilestoneInfo ${body.message}`)
  } catch (e) {
    throw e
  }

  return parsers.milestone(body)
}

async function fetchMilestoneIssues(url, id, headers) {
  const reqUrl = `${url}/issues?state=all&milestone=${id}`
  let body

  try {
    const res = await fetch(reqUrl, {headers})
    body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchMilestoneIssues ${body.message}`)
  } catch (e) {
    throw e
  }

  return parsers.milestoneIssues(body)
}


///////////
// Start //
///////////

// loading
console.log('loading...')

// prompt stuff
inquirer
  .prompt([
    {
      type: 'autocomplete',
      name: 'repo',
      message: 'what is the name of the repo?',
      source: searchRepoNames,
      pageSize: 5,
      validate: val => val ? true : 'type a repo name',
    },
  ])
  .then(async answers => {
    const repoUrl = reposUrls.get(answers.repo)
    const milestonesNames = await fetchMilestoneNames(repoUrl, ghHeaders)
    chosenRepo = repoUrl
    return milestonesNames
  })
  .then(milestonesNames => {
    return inquirer.prompt([{
      type: 'list',
      name: 'milestone',
      message: 'which milestone is it?',
      choices: milestonesNames,
    }])
  })
  .then(async answers => {
    const msUrl = milestonesUrls.get(answers.milestone)
    const milestone = await fetchMilestoneInfo(msUrl, ghHeaders)
    const issues = await fetchMilestoneIssues(chosenRepo, milestone.number, ghHeaders)
    return formatResults(milestone, issues)
  })
  .then(results => console.log(results))
