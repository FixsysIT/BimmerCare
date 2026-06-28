import { v4 as uuidv4 } from 'uuid';

/**
 * Default vehicle profile for BMW F10 523i N53.
 */
export function getDefaultVehicle() {
  return {
    vehicleId: uuidv4(),
    model: 'BMW F10 523i',
    engine: 'N53',
    year: 2010,
    plate: '',
    vin: '',
    owner: '',
    phone: '',
    purchaseDate: '2010-07-05',
    odometerAtPurchase: 0,
    currentMileage: 0,
    mileageHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
