/** Looking up the latest `atc` release on GitHub. The apply step is iteration 6. */

import { AtcError } from '../errors/index.js'
import { isNewer, parseSemver } from './semver.js'

export const ATC_REPO = 'AtomicBot-ai/atomic-chat-cli'

export interface ReleaseInfo {
  version: string
  tag: string
  url: string
  assets: Array<{ name: string; url: string; size: number }>
}

export async function fetchLatestRelease(fetchImpl: typeof fetch, repo = ATC_REPO): Promise<ReleaseInfo> {
  let res: Response
  try {
    res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'accept': 'application/vnd.github+json', 'user-agent': 'atc' },
    })
  } catch (error) {
    throw new AtcError('ATC_UPDATE_FAILED', 'Could not reach GitHub.', { details: (error as Error).message })
  }
  if (res.status === 404) throw new AtcError('ATC_UPDATE_FAILED', 'No release has been published yet.')
  if (!res.ok) throw new AtcError('ATC_UPDATE_FAILED', `GitHub answered ${res.status}.`)
  const body = (await res.json()) as {
    tag_name?: string
    html_url?: string
    assets?: Array<{ name: string; browser_download_url: string; size: number }>
  }
  const tag = body.tag_name ?? ''
  if (!parseSemver(tag)) throw new AtcError('ATC_UPDATE_FAILED', `Unexpected release tag '${tag}'.`)
  return {
    version: tag.replace(/^v/, ''),
    tag,
    url: body.html_url ?? `https://github.com/${repo}/releases/tag/${tag}`,
    assets: (body.assets ?? []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
  }
}

export interface UpdateCheck {
  current: string
  latest: string
  available: boolean
  url: string
}

export async function checkForUpdate(
  fetchImpl: typeof fetch,
  current: string,
  repo = ATC_REPO
): Promise<UpdateCheck> {
  const latest = await fetchLatestRelease(fetchImpl, repo)
  return { current, latest: latest.version, available: isNewer(latest.version, current), url: latest.url }
}
