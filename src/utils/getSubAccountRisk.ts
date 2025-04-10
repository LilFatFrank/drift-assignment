import { convertToUiDecimals } from './format';
import type { User } from '@drift-labs/sdk';

export function getSubaccountRisk(user: User) {
  const leverage = user.getLeverage().toNumber(); // e.g. 2.45x
  const marginRatio = user.getMarginRatio().toNumber(); // e.g. 4000 = 40.00%
  const freeCollateral = convertToUiDecimals(user.getFreeCollateral(), 6); // quote-asset (USD)
  const canBeLiquidated = user.canBeLiquidated();

  return {
    leverage,
    marginRatio: marginRatio / 100, // convert to percent
    freeCollateral,
    canBeLiquidated,
  };
}
