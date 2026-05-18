import { Service } from 'typedi';
import Emittery from 'emittery';

import { RuniumEvent } from '@constants';

type RuniumEventData = {
  [K in RuniumEvent]: unknown;
};

@Service()
export class EmitterService extends Emittery<RuniumEventData> {}
