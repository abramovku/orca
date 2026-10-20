import { z } from 'zod'
import { OptionalFiniteNumber, OptionalString, requiredString } from './rpc-param-primitives'

export const SlackListChannels = z.object({
  query: OptionalString,
  limit: OptionalFiniteNumber
})

export const SlackHistory = z.object({
  channel: requiredString('Missing Slack channel'),
  limit: OptionalFiniteNumber
})

export const SlackThread = z.object({
  channel: requiredString('Missing Slack channel'),
  ts: requiredString('Missing thread timestamp'),
  limit: OptionalFiniteNumber
})

export const SlackSend = z.object({
  channel: requiredString('Missing Slack channel'),
  text: requiredString('Message text cannot be empty'),
  threadTs: OptionalString
})

export const SlackSearch = z.object({
  query: requiredString('Missing search query'),
  limit: OptionalFiniteNumber
})

export const SlackListUsers = z.object({
  query: OptionalString,
  limit: OptionalFiniteNumber
})
