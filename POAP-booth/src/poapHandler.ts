import { getUserData, UserData } from '@decentraland/Identity'
import * as eth from '../node_modules/eth-connect/esm'
import * as EthereumController from '@decentraland/EthereumController'
import { getProvider } from '@decentraland/web3-provider'
import poapContract from './abis/PoapDelegateMint'
import { sceneMessageBus } from './game'

export let ethController = EthereumController

export let fireBaseServer =
  'https://us-central1-decentraland-events.cloudfunctions.net/app/'

export let userData: UserData

type eventData = {
  secret: string
  event_id: string
}

type signedEventData = {
  signed_message: string
  event_id: string
}

export async function fetchUserData() {
  const data = await getUserData()
  log(data.displayName)
  return data
}

export async function callQRAPI(event: string) {
  const url = fireBaseServer + 'get-poap-code/?event=' + event
  try {
    let response = await fetch(url)
    let data = await response.json()
    log('TOKEN: ', data.token)
    return data.token.toString()
  } catch {
    log('error fetching from token server ', url)
  }
}

export async function getSecret(qrHex: string) {
  const url = 'https://api.poap.xyz/actions/claim-qr?qr_hash=' + qrHex

  try {
    let response = await fetch(url)
    let data = await response.json()
    let json: eventData = { secret: data.secret, event_id: data.event_id }
    log('secret :', json)
    return json
  } catch {
    log('error fetching from POAP server ', url)
  }
}

export async function getSignedMessage(data: eventData, qrHex: string) {
  const url = 'https://api.poap.xyz/actions/claim-qr'
  let method = 'POST'
  let headers = { 'Content-Type': 'application/json' }
  let body = JSON.stringify({
    address: userData.publicKey,
    delegated: true,
    qr_hash: qrHex,
    secret: data.secret,
  })
  log('sending ', body)

  try {
    let response = await fetch(url, {
      headers: headers,
      method: method,
      body: body,
    })
    let data = await response.json()
    let json: signedEventData = {
      signed_message: data.delegated_signed_message,
      event_id: data.event_id,
    }
    return json
  } catch {
    log('error fetching from POAP server ', url)
  }
}

export async function makeTransaction(event: string) {
  if (!userData) {
    userData = await fetchUserData()
  }
  if (!userData.hasConnectedWeb3) {
    log('no wallet')
    /////// HARD CODED  - REMOVE REMOVE !!!!
    //userData.publicKey = '0xe2b6024873d218B2E83B462D3658D8D7C3f55a18'
    return
  }
  let qrHex: string = await callQRAPI(event)

  let secret: eventData = await getSecret(qrHex)

  let signature: signedEventData = await getSignedMessage(secret, qrHex)

  log('signature for request ', signature)

  const provider = await getProvider()
  const rm = new eth.RequestManager(provider)

  const poapTokenFactory = await new eth.ContractFactory(rm, poapContract)
  const PoapDelegatedMint = (await poapTokenFactory.at(
    //ropsten
    //'0x2f3c23b50396EcB55C73956B069CF04e493bdEf9'
    //mainnet
    '0xAac2497174f2Ec4069A98375A67D798db8a05337'
  )) as any

  await PoapDelegatedMint.mintToken(
    signature.event_id,
    userData.publicKey,
    signature.signed_message,
    {
      from: userData.publicKey,
    }
  ).then(sceneMessageBus.emit('activatePoap', {}))

  //   await PoapDelegatedMint.mintToken(
  //     256,
  //     '0xe2b6024873d218B2E83B462D3658D8D7C3f55a18',
  //     '0x7637d165bd894465d467a410d54d0d9aae8bf03353bcc921c6aae917e4a8ac8a2b58bc2134524d4f3b2108874b584fe6b73fe90fedd46619108484dad4dad76e1b',
  //     {
  //       from: '0xe2b6024873d218B2E83B462D3658D8D7C3f55a18',
  //     }
  //   ).then(sceneMessageBus.emit('activatePoap', {}))

  return
}
