const naturalFileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
})

export function naturalSortFiles<TFile extends { name: string }>(files: TFile[]): TFile[] {
  return [...files].sort((left, right) =>
    naturalFileNameCollator.compare(left.name, right.name)
  )
}

export function naturalSortFileNames(fileNames: string[]): string[] {
  return [...fileNames].sort((left, right) =>
    naturalFileNameCollator.compare(left, right)
  )
}
