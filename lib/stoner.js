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

function readGithubToken() {
  const token = fs.readFileSync('.github-token', 'utf8')
  return token.replace('\n', '')
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max))
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
      throw new Error(`fetchUserRepos ${bodyOrgs.message}`)
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

async function fetchMilestoneNames(url, headers) {
  const names = []
  let body

  try {
    const res = await fetch(url + '/milestones', {headers})
    body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchUserRepos ${body.message}`)
  } catch (e) {
    throw e
  }

  body.forEach(ms => {
    milestonesUrls.set(ms.title, ms.url)
    names.push(ms.title)
  })

  return names
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
    return milestonesNames
  })
  .then(milestonesNames => {
    return inquirer.prompt([{
      type: 'list',
      name: 'milestone',
      message: 'what is the milestone name?',
      choices: milestonesNames,
    }])
  })
  .then(answers => {
    console.log(milestonesUrls.get(answers.milestone))
  })
