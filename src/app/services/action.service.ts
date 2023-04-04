import { Injectable } from '@angular/core';
import { AngularFirestore, AngularFirestoreCollection, DocumentChangeAction } from '@angular/fire/compat/firestore';
import { Vineyard } from '../models/vineyard.model';
import { VineyardDoc } from '../models/vineyarddoc.model';
import { map } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';
import { Action, ACTION_COLORS, ActionType, BaseAction } from '../models/action.model';
import firebase from 'firebase/compat';
import { AuthService } from './auth.service';
import { UtilService } from './util.service';

export const ACTION_COLLECTION = 'actions';

@Injectable({
  providedIn: 'root',
})
export class ActionService {
  private _vineyardCollection: AngularFirestoreCollection<VineyardDoc>;

  private _actions: BehaviorSubject<Action[]>;

  constructor(private fireStore: AngularFirestore, private authService: AuthService) {
    this._actions = new BehaviorSubject<Action[]>([]);
    this.authService.getUser().subscribe((user: firebase.User) => {
      if (user) {
        this._vineyardCollection = fireStore.collection<VineyardDoc>(`users/${user.uid}/vineyards`);
      }
    });
  }

  public getActionListener(): BehaviorSubject<Action[]> {
    return this._actions;
  }

  public async addAction(vineyard: Vineyard, action: BaseAction): Promise<Action> {
    const doc = await this._vineyardCollection.doc(vineyard.id).collection<BaseAction>(ACTION_COLLECTION).add(action);
    return {
      ...action,
      id: doc.id,
      html: UtilService.parseMarkdown(action.description),
    };
  }

  public async updateAction(vineyard: Vineyard, action: BaseAction): Promise<Action> {
    await this._vineyardCollection
      .doc(vineyard.id)
      .collection<BaseAction>(ACTION_COLLECTION)
      .doc(action.id)
      .set(action);
    return {
      ...action,
      html: UtilService.parseMarkdown(action.description),
    };
  }

  public async removeAction(vineyard: Vineyard, action: BaseAction): Promise<void> {
    await this._vineyardCollection.doc(vineyard.id).collection<BaseAction>(ACTION_COLLECTION).doc(action.id).delete();
  }

  public getActions(vineyard: Vineyard): void {
    this._vineyardCollection
      .doc(vineyard.id)
      .collection<BaseAction>(ACTION_COLLECTION)
      .snapshotChanges()
      .pipe(
        map((data: DocumentChangeAction<BaseAction>[]) =>
          data.map((d: DocumentChangeAction<BaseAction>) => ({
            ...d.payload.doc.data(),
            id: (d.payload.doc as any).id,
          }))
        ),
        map((actions: BaseAction[]) =>
          [...actions].sort((a1: BaseAction, a2: BaseAction) =>
            new Date(a1.date).getTime() < new Date(a2.date).getTime() ? 1 : -1
          )
        ),
        map((actions: BaseAction[]) =>
          actions.map((a: BaseAction) => ({
            ...a,
            html: UtilService.parseMarkdown(a.description),
          }))
        )
      )
      .subscribe((actions: Action[]) => this._actions.next(actions));
  }

  public getLastUpdate(actions: BaseAction[]): string {
    const action = actions && actions.length > 0 ? actions[actions.length - 1] : undefined;
    return action ? action.date : undefined;
  }

  getActionTypeColor(stage: string): string {
    const idx = Object.keys(ActionType).findIndex((s: string) => s === stage);
    return idx >= 0 ? ACTION_COLORS[idx] : undefined;
  }

  findActionType(type: string): string {
    return Object.keys(ActionType).find((s: string) => ActionType[s] === type);
  }
}
