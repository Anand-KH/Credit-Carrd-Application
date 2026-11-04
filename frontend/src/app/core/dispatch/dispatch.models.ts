export type DispatchStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

export interface CardDispatch {
  applicationNumber: string;
  dispatchReference: string;
  dispatchDate: string;
  dispatchStatus: DispatchStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface DispatchPage {
  items: CardDispatch[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
