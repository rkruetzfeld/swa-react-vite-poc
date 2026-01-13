// src/models/estimateModels.ts

export type Status = "Draft" | "Submitted" | "Approved" | "Completed";

export type EstimateHeader = {
  estimateId: string;
  client: string;
  title: string;
  status: Status;
  dateCreated: string; // ISO string
  dueDate: string; // ISO string
  lastUpdated: string; // ISO string
};

export type EstimateLine = {
  lineId: string;
  lineNo: number;
  section: string;
  costCode: string;
  description: string;
  uom: string;
  qty: number;
  unitRate: number;
  notes?: string;
};

export type ItemCatalog = {
  section: string;
  costCode: string;
  description: string;
  uom: string;
  defaultUnitRate: number;
};
