require('dotenv').config();
const plan = require('flightplan');
const util = require('util');
const path = require('path');
const fs = require('fs');
const compareVersions = require('compare-versions');

const appName = process.argv[3];
const validAppNames = [
  'orderbook-engine',
  'tarbit-scan'
];
const isValidAppName = (validAppNames.indexOf(appName) > -1);

if (!isValidAppName) {
  console.error(`You must pass the app name as the fourth argument to this script, like so:\n\nfly deploy:live [${validAppNames.join('|')}]\n`);
  process.exit(1);
}

const getReleaseBasePath = () => {
  const today = new Date();
  const datePath = util.format('%s%s%s', String(today.getDate()).padStart(2, '0'), String(today.getMonth()).padStart(2, '0'), String(today.getFullYear()));
  return `release-${datePath}`;
}

const getNextReleasePathNumber = (remote, basepath, releasePrefix) => {
  let nextReleasePathNumber = 1;
  const lsOutput = remote.exec(`cd ${basepath} && ls -1dt ${releasePrefix}-*`, {failsafe: true,slient: true});
  
  if (lsOutput.stdout) {
    let releasePaths = lsOutput.stdout.trim().split('\n');
    let mostRecentReleasePath = releasePaths.shift();
    nextReleasePathNumber = parseInt(mostRecentReleasePath.split('-').pop()) + 1;
  }
  
  return String(nextReleasePathNumber).padStart(4, '0');
};

const getNodeVersion = (local) => {
  return String(local.exec('node --version').stdout).trim().substring(1);
};

const getShellUser = (ctx) => {
  return String(ctx.exec('whoami').stdout).trim();
}

const pathExists = (ctx, filepath) => {
  return (ctx.exec(`ls ${filepath}`, {failsafe: true}).code === 0);
}

const getJsonFromFile = (filepath) => {
  if (!fs.existsSync(filepath))
    return;
  return JSON.parse(fs.readFileSync(filepath).toString());
};

const getGitBranch = (ctx) => {
  const gitOutputLines = String(ctx.exec('git status').stdout).trim().split("\n");
  return gitOutputLines.shift().split(' ').pop();
};

const gitWorkingTreeIsDirty = (ctx) => {
  return Boolean(ctx.exec('git diff HEAD').stdout);
};

const convertDashToCamel = (s) => s.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });

// Hosts

plan.target('live', [{ 
    username: process.env.SSH_USERNAME_LIVE,
    privateKey: process.env.SSH_PRIVATEKEY_PATH_LIVE,
    host: process.env.SSH_HOST_LIVE,
    port: process.env.SSH_PORT_LIVE
  }], { 
    orderbookEngine: {
      deployPath: '/cryptomac/orderbook-engine',
      buildPath: path.resolve(path.join('..')),
      pm2ConfigPath: './configs/pm2.prod.orderbook-engine.json',
      envPath: './configs/.env.prod'
    },
    tarbitScan: {
      deployPath: '/cryptomac/tarbit-scan',
      buildPath: path.resolve(path.join('..')),
      pm2ConfigPath: './configs/pm2.prod.tarbit-scan.json',
      envPath: './configs/.env.prod'
    }   
});

const optsToken = convertDashToCamel(appName);


// Ensure that the currently available version of Node.js is compatible
plan.local(['check-node-version','build','deploy'], function(local) {

  const requiredNodeVersion = '12.0.0';
  const nodeVersion = getNodeVersion(local);
  
  if ([0,1].indexOf(compareVersions(nodeVersion, requiredNodeVersion)) === -1) {
    console.error(`Node.js required minimum version of ${nodeRequiredVersion} not met by current version ${nodeVersion}`);
    process.exit(1);
  }
});


plan.local(['build','deploy'], (local) => {
  const opts = plan.runtime.options[optsToken];
  local.log('Running build');

  local.exec(`cd ${opts.buildPath} && rm -rf ./dist-prod`);
  local.exec(`cd ${opts.buildPath} && npm run build-prod`);  
  local.exec(`cp ${opts.envPath} ${opts.buildPath}/dist-prod/.env`);
  local.exec(`cd ${opts.buildPath} && cp package.json package-lock.json ./dist-prod`);
  local.exec(`cp ${opts.pm2ConfigPath} ${opts.buildPath}/dist-prod/pm2.json`);
});

// Tar up the dist and rsync it to the remote host
plan.local(['rsync','deploy'], (local) => {
  const opts = plan.runtime.options[optsToken];
  local.log('Copying distribution to remote hosts');
  
  local.exec(`rm -f ./dist-prod.tar && cd ${opts.buildPath} && tar -cf ./deploy/dist-prod.tar dist-prod`);
  local.transfer(['dist-prod.tar'], opts.deployPath);
});

// Deploy a new version of the site
plan.remote(['release','deploy'], (remote) => {
  const opts = plan.runtime.options[optsToken];
  remote.log('Creating release');

  const pm2Config = getJsonFromFile(opts.pm2ConfigPath);
  const hasPm2 = Boolean(pm2Config);

  // create release folder
  const releaseBasePath = getReleaseBasePath();
  const nextReleasePathNumber = getNextReleasePathNumber(remote, opts.deployPath, releaseBasePath);
  const releasePath = `${opts.deployPath}/${releaseBasePath}-${nextReleasePathNumber}`;
  
  remote.log(`Creating new release in ${releasePath}`);

  const distPath = `${opts.deployPath}/dist-prod.tar`;
  remote.exec(`tar -xf ${distPath}`);
  remote.exec(`mv ./dist-prod ${releasePath}`);
  remote.exec(`rm -f ${distPath}`);

  // Install dependencies
  if (pathExists(remote, `${releasePath}/package.json`))
    remote.exec(`cd ${releasePath} && npm install --production`);

  // Link the new release
  const currentPath = `${opts.deployPath}/current`;
  remote.exec(`rm -rf ${currentPath} && ln -s ${releasePath} ${currentPath}`);

  if (hasPm2) {
    remote.exec(`pm2 delete ${pm2Config.name}`, {failsafe: true});
    remote.exec(`cd ${releasePath} && pm2 start pm2.json`);
    remote.exec('pm2 save');
  }
});

plan.local(['deploy','cleanup'], (local) => {
  const opts = plan.runtime.options[optsToken];
  local.log('Removing dist files');

  local.exec('rm -f ./dist-prod.tar');
  local.exec(`rm -rf ${opts.buildPath}/dist-prod`);
});

plan.remote(['deploy','prune'], (remote) => {
  const opts = plan.runtime.options[optsToken];
  remote.log('Pruning old releases');

  const command = remote.exec(`cd ${opts.deployPath} && ls -1dt release-*`);
  const releasePaths = command.stdout.trim().split('\n');
  const releaseCount = 3;

  releasePaths.forEach((path , index) => {
    
    // results are sorted by modification time, so skip removing the most recent releases
    if (index < releaseCount) {
      return;
    }

    // @todo these paths needs to be removed, but using rm -rf seems fundamentally unsafe. Another, safer way to remove them? Ask for confirmation?
    remote.exec(`rm -rf ${opts.deployPath}/${path}`);
  });
});