import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { PilotSettingsTabComponent } from './components/pilotSettingsTab.component'

@Injectable()
export class PilotSettingsTabProvider extends SettingsTabProvider {
    id = 'pilot'
    icon = 'fas fa-robot'
    title = 'Pilot'

    getComponentType (): any {
        return PilotSettingsTabComponent
    }
}
