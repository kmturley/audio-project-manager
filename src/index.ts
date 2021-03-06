#!/usr/bin/env node

import * as Table3 from "cli-table3";
import * as program from 'commander';
import {
  dirRead,
  fileJsonCreate,
  fileOpen,
  pathGetId,
  pathGetVersion,
  pluginCreate,
  pluginInstall,
  pluginSearch,
  pluginUninstall,
  projectInit,
  projectLoad,
  projectSave,
  validateInstall,
  validatePlugin,
} from '@studiorack/core';

const pkg = require('../package.json');

program
  .command('create <folder>')
  .option('-t, --type <type>', 'Template type (dplug, iplug, juce, steinberg)')
  .description('Create a new folder using the plugin starter template')
  .action((folder: string, options: any) => {
    pluginCreate(folder, options.type);
  });

program.command('init').description('Set up a new or existing StudioRack project.').action(projectInit);

program
  .command('install [id]')
  .option('-g, --global', 'install the plugin globally rather than locally')
  .description('Install a plugin and update project config.')
  .action(async (input: string, options: any) => {
    const project = projectLoad();
    if (input) {
      const id = pathGetId(input);
      const version = pathGetVersion(input);
      const pluginInstalled = await pluginInstall(id, version, options.global);
      if (pluginInstalled) {
        project.plugins[id] = pluginInstalled.version;
      }
    } else {
      for (const pluginId in project.plugins) {
        pluginInstall(pluginId, project.plugins[pluginId], options.global);
      }
    }
    return projectSave(project);
  });

program
  .command('uninstall [id]')
  .option('-g, --global', 'uninstall the plugin globally rather than locally')
  .description('Uninstall a plugin and update project config.')
  .action(async (input: string, options: any) => {
    const project = projectLoad();
    if (input) {
      const id = pathGetId(input);
      const version = pathGetVersion(input);
      let result: string = version;
      if (!result) {
        result = project.plugins[id];
      }
      const pluginInstalled = pluginUninstall(id, result, options.global);
      if (pluginInstalled) {
        delete project.plugins[id];
      }
    } else {
      for (const pluginId in project.plugins) {
        pluginUninstall(pluginId, project.plugins[pluginId], options.global);
      }
    }
    return projectSave(project);
  });

program
  .command('search <query>')
  .option('-j, --json', 'output results as json')
  .description('Search plugin registry by query.')
  .action(async (query: string, options: any) => {
    const results = await pluginSearch(query);
    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const table = new Table3({
        head: ['Id', 'Name', 'Description', 'Date', 'Version', 'Tags']
      });
      results.forEach((result) => {
        const latest = result.versions[result.version];
        table.push([
          result.id,
          latest.name,
          latest.description,
          latest.date.split('T')[0],
          latest.version,
          latest.tags.join(', '),
        ]);
      });
      console.log(table.toString());
      console.log(`${results.length} results found.`);
    }
  });

program
  .command('start [path]')
  .description('Start music project using the project config.')
  .action(async (path: string) => {
    const project = await projectLoad();
    await fileOpen(path || project.main);
  });

program
  .command('validate [path]')
  .option('-f, --files', 'add files (audio, video and platform)')
  .option('-j, --json', 'plugin json file')
  .option('-s, --summary', 'plugins summary json file')
  .option('-t, --txt', 'plugin txt file')
  .option('-z, --zip', 'create a zip file of plugin')
  .description('Validate a plugin using the Steinberg VST3 SDK validator')
  .action(async (pluginPath: string, options: any) => {
    const plugins: any[] = [];
    const pluginRack = {
      plugins,
    };
    await validateInstall();
    if (pluginPath.includes('*')) {
      const pathList = dirRead(pluginPath);
      pathList.forEach((pathItem) => {
        const plugin: any = validatePlugin(pathItem, options);
        if (plugin.version) {
          pluginRack.plugins.push(plugin);
        }
      });
    } else {
      const plugin: any = validatePlugin(pluginPath, options);
      if (plugin.version) {
        pluginRack.plugins.push(plugin);
      }
    }
    if (options.summary) {
      let rootPath = pluginPath.replace('**/*.{vst,vst3}', '').substring(0, pluginPath.lastIndexOf('/'));
      rootPath += rootPath.endsWith('/') ? '' : '/';
      fileJsonCreate(`${rootPath}plugins.json`, pluginRack);
      console.log(`Generated: ${rootPath}plugins.json`);
    }
  });

program.version(pkg.version).parse(process.argv);
