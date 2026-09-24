/**
 * How the running binary gets replaced, per platform: POSIX renames over the inode in use; Windows
 * cannot, so the running file is moved aside first and cleaned up on the next run.
 */

export interface ReplacePlan {
  steps: Array<
    | { op: 'rename'; from: string; to: string }
    | { op: 'chmod'; path: string; mode: number }
    | { op: 'cleanup'; glob: string }
  >
}

export function planReplace(
  platform: NodeJS.Platform,
  execPath: string,
  downloaded: string,
  stamp: string
): ReplacePlan {
  if (platform === 'win32') {
    return {
      steps: [
        { op: 'rename', from: execPath, to: `${execPath}.old-${stamp}` },
        { op: 'rename', from: downloaded, to: execPath },
        { op: 'cleanup', glob: `${execPath}.old-*` },
      ],
    }
  }
  return {
    steps: [
      { op: 'chmod', path: downloaded, mode: 0o755 },
      { op: 'rename', from: downloaded, to: execPath },
    ],
  }
}

/** The release asset for this machine, as the release workflow names it. */
export function assetNameFor(version: string, platform: NodeJS.Platform, arch: string): string {
  const os =
    platform === 'win32' ? 'pc-windows-msvc' : platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-gnu'
  const cpu = arch === 'arm64' ? 'aarch64' : 'x86_64'
  return `atc-${version}-${cpu}-${os}${platform === 'win32' ? '.exe' : ''}`
}
