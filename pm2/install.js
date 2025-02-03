
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directory containing subdirectories with index.js files
//const baseDirectoryPath = '/app/data/files/apps';

installMissingModules( process.env.EXTRA )


function installMissingModules(indexPath) {

  console.log( "\nInstalling missing modules..." )

  const fileContent = fs.readFileSync(indexPath, 'utf8');
  const requireMatches = fileContent.match(/require\(['"]([^'"]+)['"]\)/g);
  if (!requireMatches) return;

  const moduleNames = requireMatches.map(match => match.match(/require\(['"]([^'"]+)['"]\)/)[1])
                                     .filter(name => !name.startsWith('.')); // Exclude local modules

  // Attempt to read package.json in the same directory as indexPath
  const packageJsonPath = path.join(path.dirname(indexPath), 'package.json');
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } catch (e) {
    //console.log(`No package.json found or failed to parse in ${path.dirname(indexPath)}`);
    packageJson = { dependencies: {}, devDependencies: {} };
  }

  // Change working directory to the directory of indexPath
  const originalDir = process.cwd();
  process.chdir(path.dirname(indexPath));

  moduleNames.forEach(moduleName => {

    //Get base module name (eg. pocketbase/cjs --> pocketbase)
    moduleName = moduleName.split("/")[0]

    // Check if module is already in dependencies or devDependencies
    if (!packageJson.dependencies[moduleName] /*&& !packageJson.devDependencies[moduleName]*/) {
      console.log(`Installing ${moduleName}`);
      execSync(`npm install ${moduleName}`, { stdio: 'inherit' });
    } else {
      console.log(`${moduleName} ok`);
    }
  });

  // Change back to the original working directory
  process.chdir(originalDir);
  console.log("Done!\n");
}

/*
function installMissingModules( indexPath ) {

    console.log( "inst: script = " + indexPath )
    const fileContent = fs.readFileSync(indexPath, 'utf8');
    const requireMatches = fileContent.match(/require\(['"]([^'"]+)['"]\)/g);
  
    if (!requireMatches) return;
  
    const moduleNames = requireMatches.map(match => match.match(/require\(['"]([^'"]+)['"]\)/)[1])
                                       .filter(name => !name.startsWith('.')); // Exclude local modules
  
    // Change working directory to the directory of indexPath
    const originalDir = process.cwd();
    process.chdir(path.dirname(indexPath));
  
    moduleNames.forEach(moduleName => {
      try {
        require.resolve(moduleName);
      } catch (e) {
        console.log(`Installing missing module: ${moduleName} in ${path.dirname(indexPath)}`);
        execSync(`npm install ${moduleName}`, { stdio: 'inherit' });
      }
    });
  
    // Change back to the original working directory
    process.chdir(originalDir);
  }
*/