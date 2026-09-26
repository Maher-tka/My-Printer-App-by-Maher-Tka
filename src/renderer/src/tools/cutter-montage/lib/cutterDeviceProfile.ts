export interface CutterDeviceProfile {
  id: string
  manufacturer: string
  model: string
  integrationMode: 'offline-mimaki-package'
  applicationSheetMaxWidthCm: number
  applicationSheetMaxHeightCm: number
}

export const TARGET_CUTTER_PROFILE: CutterDeviceProfile = {
  id: 'mimaki-cg-130ar',
  manufacturer: 'Mimaki',
  model: 'CG-130AR',
  integrationMode: 'offline-mimaki-package',
  applicationSheetMaxWidthCm: 96,
  applicationSheetMaxHeightCm: 140
}

export const TARGET_CUTTER_LABEL = `${TARGET_CUTTER_PROFILE.manufacturer} ${TARGET_CUTTER_PROFILE.model}`
