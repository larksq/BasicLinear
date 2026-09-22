export type ProjectDensity = 'compact' | 'default' | 'comfortable';

export const projectDensityStorageKey = 'basiclinear.project-density.v1';

const rowHeights: Record<ProjectDensity, number> = {
  compact: 32,
  default: 36,
  comfortable: 44,
};

function isProjectDensity(value: unknown): value is ProjectDensity {
  return value === 'compact' || value === 'default' || value === 'comfortable';
}

export function projectRowHeight(density: ProjectDensity): number {
  return rowHeights[density];
}

export function readProjectDensity(storage: Pick<Storage, 'getItem'>): ProjectDensity {
  try {
    const value = storage.getItem(projectDensityStorageKey);
    return isProjectDensity(value) ? value : 'default';
  } catch {
    return 'default';
  }
}

export function writeProjectDensity(
  storage: Pick<Storage, 'setItem'>,
  density: ProjectDensity,
): void {
  try {
    storage.setItem(projectDensityStorageKey, density);
  } catch {
    // The visual preference remains usable for the current session.
  }
}
