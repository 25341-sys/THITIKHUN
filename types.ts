
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export enum Gender {
  Male = 'male',
  Female = 'female',
  Unknown = 'unknown',
}

export interface DetectedFace {
  gender: Gender;
  boundingBox: BoundingBox;
}
