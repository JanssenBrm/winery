import {Polygon} from 'ol/geom';
import {VineyardDoc} from './../models/vineyarddoc.model';
import {MeteoStatEntry, Vineyard} from './../models/vineyard.model';
import {Variety} from './../models/variety.model';
import {UtilService} from './util.service';
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, forkJoin, Observable, of} from 'rxjs';
import {catchError, map, switchMap, tap} from 'rxjs/operators';
import {Action, ActionType} from '../models/action.model';
import {AngularFirestore, AngularFirestoreCollection, DocumentChangeAction} from '@angular/fire/firestore';
import {GeoJSON} from 'ol/format';
import * as moment from 'moment';
import {Vintage} from '../models/vintage.model';

@Injectable({
    providedIn: 'root'
})
export class VineyardService {

    private _vineyards$: BehaviorSubject<Vineyard[]>;
    private _activeVineyard$: BehaviorSubject<Vineyard>;
    private _activeSeasons$: BehaviorSubject<number[]>;
    private _vineyardCollection: AngularFirestoreCollection<VineyardDoc>;

    private _API: string = 'https://us-central1-winery-f4d20.cloudfunctions.net';

    constructor(private http: HttpClient, private utilService: UtilService, private fireStore: AngularFirestore) {
        this._vineyards$ = new BehaviorSubject<Vineyard[]>([]);
        this._activeVineyard$ = new BehaviorSubject<Vineyard>(null);
        this._activeSeasons$ = new BehaviorSubject<number[]>([(new Date()).getFullYear()]);
        this._vineyardCollection = fireStore.collection<VineyardDoc>('vineyards');
        this.getVineyards();
    }

    getVineyardsListener(): Observable<Vineyard[]> {
        return this._vineyards$;
    }

    setActiveVineyard(id: string): void {
        this._activeVineyard$.next(id ? this._vineyards$.getValue().find((v: Vineyard) => v.id === id) : null);
    }

    getActiveVineyard(): Observable<Vineyard> {
        return this._activeVineyard$;
    }

    getActiveSeasons(): Observable<number[]> {
        return this._activeSeasons$;
    }

    setActiveSeasons(seasons: number[]): void {
        this._activeSeasons$.next(seasons);
    }

    getVineyards(): void {
        this._vineyardCollection.snapshotChanges().pipe(
            map((data: DocumentChangeAction<VineyardDoc>[]) => data.map((d: DocumentChangeAction<VineyardDoc>) => (
                {
                    ...d.payload.doc.data(),
                    id: d.payload.doc.id
                }))),
            map((docs: VineyardDoc[]) => docs.map((d: VineyardDoc) => ({
                ...d,
                location: new Polygon(JSON.parse(d.location).coordinates).transform('EPSG:4326', 'EPSG:3857')
            }))),
            tap((vineyards: Vineyard[]) => forkJoin(vineyards.map((v: Vineyard) => this.updateTempStats(v))).subscribe()),
            map((vineyards: Vineyard[]) => vineyards.map((v: Vineyard) => ({
                ...v
            })))
        ).subscribe((vineyards: Vineyard[]) => {
            this._vineyards$.next(vineyards);
        });

    }

    getInfo(id: string): Vineyard {
        return this._vineyards$.getValue().find((v: Vineyard) => v.id === id);
    }

    updateTempStats(v: Vineyard): Observable<boolean> {
        return this.http.get(`${this._API}/updateTemp?vineyardId=${v.id}`)
            .pipe(
                switchMap((data) => of(true)),
                catchError((error) => of(false))
            );

    }


    getVarieties(info: Vineyard, year: number = new Date().getFullYear()): Variety[] {
        const plantingActions = this.getActions(info, [ActionType.Planting], year);
        return plantingActions.length > 0 ? [].concat(...plantingActions.map((a: Action) => a.variety)).map((id: string) => info.varieties.find((v: Variety) => v.id === id)) : [];
    }

    getFirstPlanting(info: Vineyard): Action {
        const plantingActions = this.getActions(info, [ActionType.Planting]);
        return plantingActions.length > 0 ? plantingActions[0] : undefined;
    }

    getLastPlanting(info: Vineyard): Action {
        const plantingActions = this.getActions(info, [ActionType.Planting]);
        return plantingActions.length > 0 ? plantingActions[plantingActions.length - 1] : undefined;
    }

    getActions(info: Vineyard, types: ActionType[] = [], maxYear: number = new Date().getFullYear()): Action[] {
        let actions = info ? info.actions : [];
        if (types.length > 0) {
            actions = actions.filter((a: Action) => (types.indexOf(a.type) >= 0));
        }
        return actions.length > 0 ? actions.filter((a: Action) => new Date(a.date).getFullYear() <= maxYear) : actions;
    }

    updateLocation(id: string, geometry: Polygon): void {
        const polygons = this._vineyards$.getValue().map((v: Vineyard) => v.id === id ? ({
            ...v,
            location: geometry
        }) : v);
        this._vineyards$.next(polygons);
    }

    saveVineyards(ids: string[]) {
        const geoJSON = new GeoJSON();
        this._vineyards$.getValue()
            .filter((v: Vineyard) => ids.indexOf(v.id) >= 0)
            .map((v: Vineyard) => ({
                ...v,
                location: new Polygon(v.location.getCoordinates()).transform('EPSG:3857', 'EPSG:4326')
            }))
            .map((v: Vineyard) => ({
                ...v,
                location: geoJSON.writeGeometry(v.location)
            })).forEach((d: VineyardDoc) => this._vineyardCollection.doc(d.id).set(d));
    }

    updateVineyard(vineyard: Vineyard): void {
        const vineyards: Vineyard[] = this._vineyards$.getValue().map((v: Vineyard) => v.id === vineyard.id ? vineyard : v);
        this._vineyards$.next(vineyards);
        this.saveVineyards([vineyard.id]);
    }



    getVintageVarietiesLabel(info: Vineyard, vintage: Vintage): string {
        return ''//this.getVariety(info, vintage.varieties).map((v: Variety) => v.name).join(', ');
    }

    getMeteoYears(info: Vineyard): number[] {
        return info && info.meteo && info.meteo.data ? [...new Set(info.meteo.data.map((e: MeteoStatEntry) => moment(e.date).year()))] : [];
    }

    getMeteoByYears(info: Vineyard, years: number[]): MeteoStatEntry[] {
        return info && info.meteo && info.meteo.data ? info.meteo.data.filter((e: MeteoStatEntry) => years.indexOf(moment(e.date).year()) >= 0) : [];
    }
}
