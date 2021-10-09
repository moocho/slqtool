import configJson from './config'
import { Auth } from 'aws-amplify'

export const fetchTableColumns = async tableName => {
  const { REACT_APP_BACKEND_DETAIL_ENDPOINT } = configJson
  const url = REACT_APP_BACKEND_DETAIL_ENDPOINT + tableName
  return fetchGet(url)
}

export const fetchSavedQueries = async () => {
  const { REACT_APP_SAVE_QUERIES } = configJson
  return fetchGet(REACT_APP_SAVE_QUERIES)
}

export const fetchTables = async tableName => {
  const { REACT_APP_BACKEND_LIST_ENDPOINT } = configJson
  return fetchGet(REACT_APP_BACKEND_LIST_ENDPOINT)
}

export const fetchSaveQuery = async json => {
  const { REACT_APP_SAVE_QUERIES } = configJson
  return fetchPost(REACT_APP_SAVE_QUERIES, json)
}

export const fetchQuery = async queryObject => {
  const { REACT_APP_BACKEND_ENDPOINT } = configJson
  return fetchPost(REACT_APP_BACKEND_ENDPOINT, queryObject)
}

export const fetchExportExcel = async queryObject => {
  const { REACT_APP_EXPORT_EXCEL } = configJson
  return fetchPost(REACT_APP_EXPORT_EXCEL, queryObject)
}

const fetchGet = async url => {
  const authorizer = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authorizer}`,
  }
  const options = { method: 'get', headers }

  const response = await fetch(url, options)

  if (!response) {
    throw new Error('There is no response')
  }

  return response.json()
}

const getToken = async () => {
  const token = await new Promise((resolve, reject) => {
    Auth.currentSession()
      .then(session => resolve(session.idToken.jwtToken))
      .catch(err => reject({ message: 'Unknown error' }))
  })

  return token
}

const fetchPost = async (url, postObject) => {
  const authorizer = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authorizer}`,
  }
  const options = {
    method: 'post',
    headers,
    body: JSON.stringify(postObject),
  }
  const response = await fetch(url, options)
  return response.json()
}

export{
  getToken
}
