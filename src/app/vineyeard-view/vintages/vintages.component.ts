import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {AddActionComponent} from '../add-action/add-action.component';
import {AlertController, ModalController} from '@ionic/angular';
import {Vineyard} from '../../models/vineyard.model';
import {AddVintageComponent} from '../add-vintage/add-vintage.component';
import {Vintage, VINTAGE_STATUS, VINTAGE_STATUS_COLORS} from '../../models/vintage.model';
import {VintageService} from '../../services/vintage.service';
import {BehaviorSubject} from 'rxjs';
import {VineyardService} from '../../services/vineyard.service';
import {Note} from '../../models/note.model';
import {NotesService} from '../../services/notes.service';
import {AddNoteComponent} from '../add-note/add-note.component';
import {VintageEvent} from '../../models/vintageevent.model';
import {VarietyService} from '../../services/variety.service';

@Component({
  selector: 'app-vintages',
  templateUrl: './vintages.component.html',
  styleUrls: ['./vintages.component.scss'],
})
export class VintagesComponent implements OnChanges {

  @Input()
  vineyard: Vineyard;

  @Input()
  vintages: Vintage[];

  @Input()
  vintage: Vintage;

  tab: 'timeline' | 'notes' = 'timeline';

  VINTAGE_STATUS = VINTAGE_STATUS;
  VINTAGE_STATUS_COLORS = VINTAGE_STATUS_COLORS;


  constructor(
      private modalController: ModalController,
      public vintageService: VintageService,
      public vineyardService: VineyardService,
      private alertController: AlertController,
      public varietyService: VarietyService
  ) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.vintages && !this.vintage) {
      this.setVintage(this.vintages[0]);
    }
  }

  async openAddVintageModal(vintage?: Vintage) {
    const modal = await this.modalController.create({
      component: AddVintageComponent,
      componentProps: {
        vineyard: this.vineyard,
        vintage
      }
    });
    modal.present();

    const data = await modal.onWillDismiss();
    if (data.data.vintage) {
      this.parseVintage(data.data.vintage);
    }
  }

  async openDeleteConfirm(vintage: Vintage) {
    const alert = await this.alertController.create({
      header: 'Are you sure?',
      message: `Do want to delete vintage ${vintage.name}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary',
          handler: (blah) => {
          }
        }, {
          text: 'Okay',
          handler: () => {
            this.vintageService.removeVintage(this.vineyard, vintage);
          }
        }
      ]
    });

    await alert.present();
  }

  private parseVintage(vintage: Vintage) {
    vintage.id ? this.vintageService.updateVintage(this.vineyard, vintage) : this.vintageService.addVintage(this.vineyard, vintage);
    this.vintage = vintage;
  }

  setVintage(vintage: Vintage) {
    this.vintage = vintage;
    this.setTab('timeline');
  }

  editVintage(vintage: Vintage) {
    this.openAddVintageModal(vintage);
  }

  deleteVintage(vintage: Vintage) {
    this.openDeleteConfirm(vintage);
  }

  setTab(tab: 'timeline' | 'notes') {
    this.tab = tab;
  }

  getVarieties(vintage: Vintage): string {
    return vintage.varieties
        .map((v: string) => this.varietyService.getVarietyByID(v).name)
        .join(',');
  }

}
