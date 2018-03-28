#!/usr/bin/env node
const fs = require('fs') // eslint-disable-line
const chalk = require('chalk')
const emoji = require('node-emoji')
const fuzzy = require('fuzzy')
const inquirer = require('inquirer')
const fetch = require('node-fetch')
const util = require('util')

// config
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))

// promisify stuff
const readFile = util.promisify(fs.readFile)

// global
const repoNames = fetchRepoNames()


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

async function readGithubToken() {
  const token = await readFile('.github-token', 'utf8')
  return token.replace('\n', '')
}

async function fetchRepoNames() {
  const root = 'https://api.github.com/'
  const token = await readGithubToken()
  const meta = {
    'Content-type': 'application/json',
    'Authorization': `token ${token}`,
  }
  const headers = new fetch.Headers(meta)

  try {
    const resUserRepos = await fetch(root + 'user/repos', {headers})
    const arrUserRepos = await resUserRepos.json()
    const resOrgs = await fetch(root + 'user/orgs', {headers})
    const arrOrgs = await resOrgs.json()
    const arrOrgsUrls = arrOrgs.map(o => o.repos_url)
    const arrUserReposNames = arrUserRepos.map(o => o.name)
    const arrOrgsReposName = await fetchUserOrgsRepo(arrOrgsUrls, headers)
    const allRepos = []

    return allRepos.concat(arrUserReposNames, arrOrgsReposName).sort()
  } catch (e) {
    throw e
  }
}

// TODO fix race condition with this guy...
async function fetchUserOrgsRepo(orgsUrls, headers) {
  let repoNames = []
  orgsUrls.forEach(async url => {
    const resOrgRepos = await fetch(url, {headers})
    const arrOrgRepos = await resOrgRepos.json()
    const arrOrgReposNames = arrOrgRepos.map(o => o.name)
    repoNames = repoNames.concat(arrOrgReposNames)
  })
  return repoNames
}

async function searchRepoNames(answers, input) {
  const repos = await repoNames
  return new Promise(resolve => {
    setTimeout(() => {
      const fuzzyResult = fuzzy.filter(input || '', repos)
      resolve(fuzzyResult.map(element => {
        return element.original
      }))
    }, getRandomInt(300))
  })
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max))
}


///////////
// Start //
///////////

// loading
console.log('loading...')

// prompt stuff
inquirer.prompt([
  {
    type: 'autocomplete',
    name: 'repo',
    message: 'what is the name of the repo?',
    source: searchRepoNames,
    pageSize: 5,
    validate: val => val ? true : 'type a repo name',
  },
]).then(answers => {
  console.log(JSON.stringify(answers, null, 2))
})
