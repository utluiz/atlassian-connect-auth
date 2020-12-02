const jwt = require('atlassian-jwt')
const { Addon, AuthError } = require('../lib')

const baseUrl = 'https://test.example.com'

const jiraPayload = {
  baseUrl: 'https://test.atlassian.net',
  clientKey: 'jira-client-key',
  sharedSecret: 'shh-secret-cat'
}

const jiraAddon = new Addon({
  product: 'jira',
  baseUrl
})

describe('Auth', () => {
  test('Missing token', async () => {
    const req = {
      body: jiraPayload,
      headers: {},
      query: {}
    }

    await expect(jiraAddon.auth(req, {})).rejects.toMatchError(
      new AuthError('Missed token', 'MISSED_TOKEN')
    )
  })

  test('Failed to decode token', async () => {
    const token = 'abc.def.ghi'

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {}
    }

    await expect(jiraAddon.auth(req, {})).rejects.toMatchError(
      new AuthError(
        'Failed to decode token',
        'FAILED_TO_DECODE',
        new SyntaxError('Unexpected token i in JSON at position 0')
      )
    )
  })

  test('Unknown issuer', async () => {
    const loadCredentials = () => null
    const token = jwt.encode({
      iss: jiraPayload.clientKey
    }, jiraPayload.sharedSecret)

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {}
    }

    await expect(jiraAddon.auth(req, {
      loadCredentials
    })).rejects.toMatchError(
      new AuthError('Unknown issuer', 'UNKNOWN_ISSUER')
    )
  })

  test('Invalid signature', async () => {
    const token = jwt.encode({
      iss: jiraPayload.clientKey
    }, 'invalid-shared-secret')

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {}
    }

    await expect(jiraAddon.auth(req, {
      loadCredentials: () => jiraPayload
    })).rejects.toMatchError(
      new AuthError(
        'Invalid signature',
        'INVALID_SIGNATURE',
        new Error(
          'Signature verification failed for input: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqaXJhLWNsaWVudC1rZXkifQ with method sha256'
        )
      )
    )
  })

  test('Token expired', async () => {
    const now = Math.floor(Date.now() / 1000)

    const token = jwt.encode({
      iss: jiraPayload.clientKey,
      exp: now - 1000
    }, jiraPayload.sharedSecret)

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {}
    }

    await expect(jiraAddon.auth(req, {
      loadCredentials: () => jiraPayload
    })).rejects.toMatchError(
      new AuthError('Token expired', 'TOKEN_EXPIRED')
    )
  })

  test('Invalid QSH', async () => {
    const token = jwt.encode({
      iss: jiraPayload.clientKey,
      qsh: 'invalid-qsh'
    }, jiraPayload.sharedSecret)

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
      method: 'POST'
    }

    await expect(jiraAddon.auth(req, {
      loadCredentials: () => jiraPayload
    })).rejects.toMatchError(
      new AuthError('Invalid QSH', 'INVALID_QSH')
    )
  })

  test('No "qsh" in JWT token provided', async () => {
    const token = jwt.encode({
      iss: jiraPayload.clientKey
    }, jiraPayload.sharedSecret)

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
      method: 'POST'
    }

    const result = await jiraAddon.auth(req, {
      loadCredentials: () => jiraPayload
    })

    expect(result).toHaveProperty('credentials')
    expect(result).toHaveProperty('payload')
  })

  test('"skipQsh" passed', async () => {
    const token = jwt.encode({
      iss: jiraPayload.clientKey
    }, jiraPayload.sharedSecret)

    const req = {
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
      method: 'POST'
    }

    const result = await jiraAddon.auth(req, {
      loadCredentials: () => jiraPayload,
      skipQsh: true
    })

    expect(result).toHaveProperty('credentials')
    expect(result).toHaveProperty('payload')
  })
})
