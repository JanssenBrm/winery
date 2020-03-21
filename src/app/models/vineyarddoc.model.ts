import { Vineyard } from './vineyard.model';
import {DocumentReference} from '@angular/fire/firestore';
import { Action } from './action.model';


export interface VineyardDoc {
    name: string;
    address: string;
    location: string;
    actions: Action[];
}
