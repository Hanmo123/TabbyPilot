import { Injectable } from '@angular/core'
import { HotkeyDescription, HotkeyProvider } from 'tabby-core'

@Injectable()
export class PilotHotkeyProvider extends HotkeyProvider {
    hotkeys: HotkeyDescription[] = [
        {
            id: 'pilot-open-chat',
            name: 'Open Pilot Chat',
        },
    ]

    async provide (): Promise<HotkeyDescription[]> {
        return this.hotkeys
    }
}
