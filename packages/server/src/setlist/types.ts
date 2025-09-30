// packages/server/src/setlist/types.ts
export type SetlistParseOptions = {
  excludeNonSongs: boolean;
  keepEncoreMarkers: boolean;
  ignoreCase?: boolean;
};

export type RawSetlistLine = {
  original: string;
  lineNumber: number;
};

export type NormalizedSetlistLine = {
  title: string;
  tags: string[];
  isEncoreMarker: boolean;
  isNonSong: boolean;
  raw: RawSetlistLine;
};

export type SetlistTrackBlock = {
  type: 'track';
  track: NormalizedSetlistLine;
};

export type SetlistSectionBlock = {
  type: 'section';
  name: string;
};

export type SetlistBlock = SetlistTrackBlock | SetlistSectionBlock;

export type SetlistParseMetadata = {
  encoreCount: number;
  totalLines: number;
  skippedLines: RawSetlistLine[];
};

export type SetlistParseResult = {
  blocks: SetlistBlock[];
  metadata: SetlistParseMetadata;
};
