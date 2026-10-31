import assert from 'node:assert/strict'
import { test } from 'node:test'
import { preferredAudioIndex } from '../src/widgets/video-player/model/audio-preference.ts'

test('audio preference matches a voice name rather than its episode-specific position', () => {
  assert.equal(preferredAudioIndex(['Студия А', 'Студия Б'], 'студия   б'), 1)
  assert.equal(preferredAudioIndex(['Студия Б', 'Студия А'], 'Студия Б'), 0)
  assert.equal(preferredAudioIndex(['Студия А'], 'Студия Б'), -1)
  assert.equal(preferredAudioIndex(['Студия А'], null), -1)
})
