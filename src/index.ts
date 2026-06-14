import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCoreModule, { ConfigProvider, HotkeyProvider, HostAppService, AppService, HotkeysService } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { PilotTabComponent } from './components/pilotTab.component'
import { PilotSettingsTabComponent } from './components/pilotSettingsTab.component'

import { PilotConfigProvider } from './config'
import { PilotSettingsTabProvider } from './settings'
import { PilotHotkeyProvider } from './hotkeys'

import { PilotAIService } from './services/ai.service'
import { SessionService } from './services/session.service'

@NgModule({
    imports: [
        NgbModule,
        CommonModule,
        FormsModule,
        TabbyCoreModule,
    ],
    providers: [
        { provide: ConfigProvider, useClass: PilotConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: PilotSettingsTabProvider, multi: true },
        { provide: HotkeyProvider, useClass: PilotHotkeyProvider, multi: true },
        PilotAIService,
        SessionService,
    ],
    declarations: [
        PilotTabComponent,
        PilotSettingsTabComponent,
    ],
})
export default class PilotModule {
    constructor(
        private app: AppService,
        private hotkeys: HotkeysService,
    ) {
        hotkeys.hotkey$.subscribe(hotkey => {
            if (hotkey === 'pilot-open-chat') {
                this.openChatTab()
            }
        })
    }

    private openChatTab(): void {
        this.app.openNewTab({
            type: PilotTabComponent,
            inputs: {},
        })
    }
}

export * from './api'
export { PilotTabComponent }
