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

async function fetchUserRepos(u, headers) {
  let repos = []

  try {
    const res = await fetch(u + 'user/repos', {headers})
    const body = await res.json()

    if (res.status !== 200)
      throw new Error(`fetchUserRepos ${body.message}`)
    else
      repos = body.map(o => o.name)
  } catch (e) {
    throw e
  }

  return repos
}

async function fetchRepoNames(url, headers) {
  let allRepos = []
  let userRepos = []

  try {
    userRepos = await fetchUserRepos(url, headers)
    allRepos = allRepos.concat(userRepos)
  } catch (e) {
    throw e
  }
  return allRepos.sort()
}

async function searchRepoNames(answers, input) {
  const repos = await fetchRepoNames(ghUrl, ghHeaders)
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
