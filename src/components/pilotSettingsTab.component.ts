import { Component, HostBinding } from "@angular/core";
import { ConfigService } from "tabby-core";

@Component({
  selector: "pilot-settings-tab",
  template: require("./pilotSettingsTab.component.pug"),
  styles: [require("./pilotSettingsTab.component.scss")],
})
export class PilotSettingsTabComponent {
  @HostBinding("class.content-box") true;

  modelOptions = [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
    { value: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  ];

  constructor(public config: ConfigService) {}

  saveConfig(): void {
    this.config.save();
  }
}
