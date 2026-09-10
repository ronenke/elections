export interface Party {
  id: string;
  name: string;
  letters: string;
  blocId: string | null;
  /** display order in admin/results */
  order: number;
}

export interface Bloc {
  id: string;
  name: string;
  color: string; // hex
}

export interface Agreement {
  a: string;
  b: string;
}

export type SourceKind = "manual" | "cec-fetch" | "cec-paste" | "restore" | "seed";

export type ElectionStatus = "open" | "closed";

export interface ElectionState {
  /** unique id of this election (one row in the elections table) */
  id: string;
  /** "open" = results can be edited; "closed" = results are final, all editing is locked */
  status: ElectionStatus;
  createdAt: string;
  version: number;
  updatedAt: string;
  election: {
    name: string;
    date: string;
    /** URL of the CEC national results page, e.g. https://votes26.bechirot.gov.il/ */
    cecUrl: string;
  };
  parties: Party[];
  blocs: Bloc[];
  agreements: Agreement[];
  votes: Record<string, number>;
  /** valid votes for lists not tracked individually (counts toward the threshold base) */
  otherValidVotes: number;
  /** what the CEC reports as counted so far, free text + percent */
  countedPercent: number | null;
  note: string;
  source: SourceKind;
}

export interface Snapshot {
  id: number;
  election_id: string;
  created_at: string;
  note: string;
  data: ElectionState;
}

/** Row in the elections list (without the full data) */
export interface ElectionSummary {
  id: string;
  name: string;
  date: string;
  status: ElectionStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}
