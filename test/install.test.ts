import * as jwt from 'atlassian-jwt';
import { request } from 'express';
import { cloneDeep } from 'lodash';

import { Addon, AuthError } from '../src';

const baseUrl = 'https://test.example.com';
const saveCredentials = jest.fn();

const jiraPayload = {
  baseUrl: 'https://test.atlassian.net',
  clientKey: 'jira-client-key',
  sharedSecret: 'shh-secret-cat',
};

const bitbucketPayload = {
  principal: { uuid: 'bitbucket-workspace-id' },
};

const jiraAddon = new Addon({
  product: 'jira',
  baseUrl,
});

const bitbucketAddon = new Addon({
  product: 'bitbucket',
  baseUrl,
});

const noop = () => null;

function createReq(props) {
  return Object.assign(cloneDeep(request), props);
}

describe('Installation', () => {
  test('First Jira add-on install', async () => {
    const req = createReq({ body: jiraPayload, headers: {}, query: {} });
    const loadCredentials = noop;

    const result = await jiraAddon.install(req, {
      loadCredentials,
      saveCredentials,
    });

    expect(result.credentials).toEqual(jiraPayload);
  });

  test('First Bitbucket add-on install', async () => {
    const req = createReq({ body: bitbucketPayload, headers: {}, query: {} });
    const loadCredentials = () => null;

    const result = await bitbucketAddon.install(req, {
      loadCredentials,
      saveCredentials,
    });

    expect(result.credentials).toEqual(bitbucketPayload);
  });

  test('Failed to decode token', async () => {
    const token = 'abc.def.ghi';

    const req = createReq({
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
    });

    await expect(jiraAddon.auth(req, { loadCredentials: noop })).rejects.toMatchError(
      new AuthError(
        'Failed to decode token',
        'FAILED_TO_DECODE',
        new SyntaxError('Unexpected token i in JSON at position 0')
      )
    );
  });

  test('Passed different id in body and authorization header', async () => {
    const loadCredentials = () => null;
    const token = jwt.encode(
      {
        iss: 'different-id',
      },
      jiraPayload.sharedSecret
    );

    const req = createReq({
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
    });

    await expect(
      jiraAddon.install(req, {
        loadCredentials,
        saveCredentials,
      })
    ).rejects.toMatchError(new AuthError('Wrong issuer', 'WRONG_ISSUER'));
  });

  test('Second and subsequent Jira add-on install', async () => {
    const loadCredentials = () => jiraPayload;
    const token = jwt.encode(
      {
        iss: jiraPayload.clientKey,
      },
      jiraPayload.sharedSecret
    );

    const req = createReq({
      body: jiraPayload,
      headers: { authorization: `JWT ${token}` },
      query: {},
    });

    const result = await jiraAddon.install(req, {
      loadCredentials,
      saveCredentials,
    });

    expect(result.credentials).toEqual(jiraPayload);
    expect(result.payload).toEqual({
      iss: jiraPayload.clientKey,
    });
  });

  test('Unauthorized request to updated existing instance', async () => {
    const loadCredentials = () => jiraPayload;
    const req = createReq({ body: jiraPayload, headers: {}, query: {} });

    await expect(
      jiraAddon.install(req, {
        loadCredentials,
        saveCredentials,
      })
    ).rejects.toMatchError(new AuthError('Unauthorized update request', 'UNAUTHORIZED_REQUEST'));
  });
});