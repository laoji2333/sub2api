import { describe, expect, it } from 'vitest'
import { buildPlaygroundParameterPayload } from '../parameters'
import { defaultPlaygroundSettings } from '../storage'

describe('playground parameter payload', () => {
  it('omits every optional parameter by default', () => {
    expect(buildPlaygroundParameterPayload(defaultPlaygroundSettings())).toEqual({})
  })

  it('sends only enabled parameters and normalizes their values', () => {
    const settings = defaultPlaygroundSettings()
    settings.temperature = 3
    settings.top_p = 0.35
    settings.max_tokens = 0
    settings.parameters_enabled.temperature = true
    settings.parameters_enabled.max_tokens = true

    expect(buildPlaygroundParameterPayload(settings)).toEqual({
      temperature: 2,
      max_output_tokens: 128
    })
  })
})
