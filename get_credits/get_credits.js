/*
 * © 2024 AxonOps Limited. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The fastest and simplest library for SQLite3 in Node.js
const SQLite3 = require('better-sqlite3'),
  Path = require('path'),
  FS = require('fs-extra'),
  Terminal = require('node-cmd')

Terminal.run(`cd "${Path.join(__dirname, '..')}" && npx license-checker --json > "${Path.join(__dirname, 'packages-list.json')}"`, (err, data, stderr) => {
  setTimeout(() => {
    let packagesList = require(Path.join(__dirname, 'packages-list.json')),
      mainPackages = require(Path.join(__dirname, '..', 'package.json'))

    // Connect with the associated database
    let database = new SQLite3(Path.join(__dirname, '..', 'data', 'credits.db'))

    database.prepare('DELETE FROM credits where static = ?').run('0')

    let requiredPackages = Object.keys(mainPackages.devDependencies).concat(Object.keys(mainPackages.dependencies))

    let escapeSQLString = (input) => {
      // Replace single quotes with two single quotes
      let escaped = input.replace(/'/g, "''");

      // Replace newlines with \n
      // escaped = escaped.replace(/\r?\n/g, "\\n");
      return escaped.replace(/"/gi, '""');
    }


    let getInfo = async (packages, index = 0) => {
      let package = packages[index];

      if (package == undefined) return console.log('Finished');

      let modifiedPackage = package.replace(/(\@.+)$/gi, '');

      try {
        if (
          `${modifiedPackage}`.trim().length <= 0 ||
          !requiredPackages.includes(modifiedPackage)
        )
          throw 0;

        let packageJSONInfo = packagesList[package],
          info = {
            name: modifiedPackage,
            license: packageJSONInfo.licenses,
            repository: packageJSONInfo.repository,
            content: await FS.readFileSync(packageJSONInfo.licenseFile, 'utf8'),
          };

        info.content = escapeSQLString(info.content)

        try {
          database.prepare('INSERT INTO credits (name, license, repository,content) VALUES (@name, @license, @repository, @content)').run(info)
        } catch (e) {}
      } catch (e) {} finally {
        getInfo(packages, ++index);
      }
    }

    getInfo(Object.keys(packagesList));
  })
})
