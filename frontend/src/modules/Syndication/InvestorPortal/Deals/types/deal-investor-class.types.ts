export interface DealInvestorClass {
  id: string
  dealId: string
  name: string
  subscriptionType: string
  entityName: string
  startDate: string
  offeringSize: string
  minimumInvestment: string
  pricePerUnit: string
  status: string
  visibility: string
  createdAt: string
  updatedAt: string
}

export interface DealInvestorClassFormValues {
  name: string
  subscriptionType: string
  entityName: string
  startDate: string
  offeringSize: string
  minimumInvestment: string
  pricePerUnit: string
  status: string
  visibility: string
}
