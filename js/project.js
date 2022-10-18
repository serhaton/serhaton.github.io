const React = require('react');
const ReactDOM = require('react-dom/client');
const { JsonRpcProvider } = require("@mysten/sui.js");
const { EthosWrapper, SignInButton, ethos } = require('ethos-wallet-beta');

const leaderboard = require('./leaderboard');
const { contractAddress } = require('./constants');
const { 
  eById, 
  eByClass, 
  addClass, 
  removeClass,
  truncateMiddle,
  setOnClick
} = require('./utils');
const modal = require('./modal');
const queue = require('./queue');
//const board = require('./board');
//const moves = require('./moves');
//const confetti = require('./confetti');

const DASHBOARD_LINK = 'https://ethoswallet.xyz/dashboard';

let walletSigner;
let projects; //games
let activeProjectAddress; //activeProjectAddress
let walletContents = {};
//let topTile = 2;
let contentsInterval;
let faucetUsed = false;


function init() {
  // test();

  //leaderboard.load();
  
  const ethosConfiguration = {
    appId: 'talentOnChain'
  };

  const start = eById('ethos-start');
  const button = React.createElement(
    SignInButton,
    {
      key: 'sign-in-button',
      className: 'start-button',
      children: "Sign In"
    }
  )

  const wrapper = React.createElement(
    EthosWrapper,
    {
      ethosConfiguration,
      onWalletConnected,
      children: [button]
    }
  )

  const root = ReactDOM.createRoot(start);
  root.render(wrapper);
  
  initializeClicks();
}

function handleResult(newBoard, direction) { 
  /*
  if (newBoard.topTile > topTile) {
    topTile = newBoard.topTile;
    const topTiles = eByClass('top-tile-display');
    for (const topTile of topTiles) {
      topTile.innerHTML = `<img src='${newBoard.url}' />`;
    }
    confetti.run();

    setTimeout(() => {
      if (topTile >= leaderboard.minTile() && newBoard.score > leaderboard.minScore()) {
        modal.open('high-score', 'container')
      } else {
        modal.open('top-tile', 'container')
      }
    }, 1000)
  }
  */
  //const tiles = eByClass('tile');
  //const resultDiff = board.diff(board.active().spaces, newBoard.spaces, direction);
 
  //const scoreDiff = parseInt(newBoard.score) - parseInt(board.active().score)
  /*
  if (scoreDiff > 0) {
    const scoreDiffElement = eById('score-diff');
    scoreDiffElement.innerHTML = `+${scoreDiff}`;
    addClass(scoreDiffElement, 'floating');
    setTimeout(() => {
      removeClass(scoreDiffElement, 'floating');
    }, 2000);
  }

  for (const key of Object.keys(resultDiff)) {
    const resultItem = resultDiff[key];
    const tile = tiles[parseInt(key)];
    
    if (resultItem[direction]) {
      const className = `${direction}${resultItem[direction]}`;
      addClass(tile, className);
      setTimeout(() => {
        removeClass(tile, className);
      }, 500);
    }

    if (resultItem.merge) {
      setTimeout(() => {
        addClass(tile, "merge");
        setTimeout(() => {
          removeClass(tile, "merge");
        }, 500)
      }, 80);
    }
  }

  setTimeout(() => {
    board.display(newBoard)
  }, 150)
  */
}

function showGasError() {
  queue.removeAll()
  removeClass(eById("error-gas"), 'hidden');
}

function showUnknownError(error) {
  queue.removeAll()
  eById('error-unknown-message').innerHTML = error;
  removeClass(eById("error-unknown"), 'hidden');
}

async function syncAccountState() {
  if (!walletSigner) return;
  const address =  await walletSigner.getAddress();
  const provider = new JsonRpcProvider('https://gateway.devnet.sui.io/');
  await provider.syncAccountState(address);
}

async function tryDrip() {
  if (!walletSigner || faucetUsed) return;

  faucetUsed = true;

  const address =  await walletSigner.getAddress();

  let success;
  try {
    success = await ethos.dripSui({ address });
  } catch (e) {
    console.log("Error with drip", e);
    faucetUsed = false;
    return;
  }

  try {
    await syncAccountState();
  } catch (e) {
    console.log("Error with syncing account state", e);
  }

  if (!success) {
    const { balance: balanceCheck } = await ethos.getWalletContents(address, 'sui')
    if (balance !== balanceCheck) {
      success = true;      
    }
  }

  if (success) {
    removeClass(eById('faucet'), 'hidden');
    faucetUsed = true;
    loadWalletContents();
  }
}

async function loadWalletContents() {
  if (!walletSigner) return;
  const address = await walletSigner.getAddress();
  eById('wallet-address').innerHTML = truncateMiddle(address, 4);
  walletContents = await ethos.getWalletContents(address, 'sui');
  const balance = walletContents.balance || 0;

  if (balance < 5000000) {
    tryDrip(address);
  }

  const balanceSting = (balance || "").toString();
  eById('balance').innerHTML = balanceSting.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ' SUI';
}

async function loadProjects() {
  if (!walletSigner || !leaderboard) {
    setTimeout(loadProjects, 500);
    return;
  }
  removeClass(eById('loading-projects'), 'hidden');
//debugger;
  const projectsElement = eById('project-list');
  projectsElement.innerHTML = "";
  
  await loadWalletContents();

  addClass(eById('loading-projects'), 'hidden');
  
  projects = walletContents.nfts.filter(
    (nft) => nft.package === contractAddress
  ).map(
    (nft) => ({
      address: nft.address,
      //boards: nft.extraFields.boards,
      //topTile: nft.extraFields.top_tile,
      projectName: nft.extraFields.projectName,
      imageUri: nft.imageUri
    })
  ); //.sort((a, b) => b.score - a.score);
 
  if (!projects || projects.length === 0) {
    const newProjectArea = document.createElement('DIV');
    newProjectArea.classList.add('text-center');
    newProjectArea.classList.add('padded');
    newProjectArea.innerHTML = `
      <p>
        You don't have any projects yet.
      </p>
    `;
    projectsElement.append(newProjectArea);
  }

  for (const project of projects) {
    const projectElement = document.createElement('DIV');
    
    let topProjects = []; // leaderboard.topGames();
    if (topProjects.length === 0) topProjects = [];
    const leaderboardItemIndex = topProjects.findIndex(
      (top_game) => top_game.fields.game_id === project.address
    );
    const leaderboardItem = topProjects[leaderboardItemIndex];
    const leaderboardItemUpToDate = leaderboardItem?.fields.score === project.score
    
    addClass(projectElement, 'project-preview');
    setOnClick(
      projectElement,
      () => {
        addClass(eById('leaderboard'), 'hidden');
        removeClass(eById('project'), 'hidden');
        setActiveProject(project);
      }
    );

    projectElement.innerHTML = `
      <div class='leader-stats flex-1'> 
        <div class='leader-tile subsubtitle color${project.topTile + 1}'>
          ${Math.pow(2, project.topTile + 1)}
        </div>
        <div class='leader-score'>
          Score <span>${project.score}</span>
        </div>
      </div>
      <div class='project-preview-right'> 
        <div class="${leaderboardItem && leaderboardItemUpToDate ? '' : 'hidden'}">
          <span class="light">Leaderboard:</span> <span class='bold'>${leaderboardItemIndex + 1}</span>
        </div>
        <button class='potential-leaderboard-project ${leaderboardItemUpToDate ? 'hidden' : ''}' data-address='${project.address}'>
          ${leaderboardItem ? 'Update' : 'Add To'} Leaderboard
        </button>
      </div>
    `

    projectsElement.append(projectElement);
  }

  setOnClick(
    eByClass('potential-leaderboard-project'),
    (e) => {
      const { dataset: { address } } = e.target;
      e.stopPropagation();
      leaderboard.submit(
        address, 
        walletSigner, 
        () => {
          loadProjects();
        }
      )
    }
  )
}

async function setActiveGame(project) {
  activeProjectAddress = project.address;

  eById('transactions-list').innerHTML = "";
  /*
  moves.reset();
  moves.checkPreapprovals(activeProjectAddress, walletSigner);
  
  moves.load(
    walletSigner,
    activeProjectAddress,
    (newBoard, direction) => {
      handleResult(newBoard, direction);
      loadWalletContents();
    },
    (error) => {
      if (error) {
        showUnknownError(error)
      } else {
        showGasError();
      }
    }
  );

  const boards = game.boards;
  const activeBoard = board.convertInfo(boards[boards.length - 1]);
  topTile = activeBoard.topTile || 2;
  board.display(activeBoard);
*/
  modal.close();
  addClass(eById("leaderboard"), 'hidden');
  removeClass(eByClass('leaderboard-button'), 'selected')
  removeClass(eById("project"), 'hidden');
  addClass(eByClass('play-button'), 'selected')

  setOnClick(
    eById('submit-project-to-leaderboard'), 
    () => {
      showLeaderboard();
      leaderboard.submit(
        activeProjectAddress, 
        walletSigner, 
        () => {
          loadProjects();
        }
      )
    }
  );
}

function showLeaderboard() {
  leaderboard.load();
  loadProjects();
  addClass(eById('project'), 'hidden');
  removeClass(eByClass('play-button'), 'selected');
  removeClass(eById('leaderboard'), 'hidden');
  addClass(eByClass('leaderboard-button'), 'selected');
}

const initializeClicks = () => {
  setOnClick(eByClass('close-error'), () => {
    addClass(eByClass('error'), 'hidden');
  })
  setOnClick(eById('sign-in'), ethos.showSignInModal);
  setOnClick(eByClass('leaderboard-button'), showLeaderboard)
  setOnClick(eByClass('title'), ethos.showWallet)
  
  setOnClick(
    eById('balance'), 
    () => window.open(DASHBOARD_LINK)
  )
  setOnClick(
    eById('wallet-address'), 
    () => window.open(DASHBOARD_LINK)
  )

  setOnClick(
    eById('logout'),
    async (e) => {
      e.stopPropagation();
      await ethos.logout(walletSigner);
      walletSigner = null;
      projects = null;
      activeProjectAddress = null;
      walletContents = {};

      addClass(document.body, 'signed-out');
      removeClass(document.body, 'signed-in');
      addClass(eById('leaderboard'), 'hidden');
      removeClass(eById('project'), 'hidden');
      addClass(eById('loading-projects'), 'hidden');

      project.clear();
      
      modal.open('get-started', 'project', true);
    }
  );

  setOnClick(eById('close-modal'), () => modal.close(true));

  setOnClick(
    eByClass('play-button'), 
    () => {
      if (projects && projects.length > 0) {
        addClass(eById('leaderboard'), 'hidden');
        removeClass(eById('project'), 'hidden');
        setActiveGame(projects[0]);
      } else if (walletSigner) {
        eByClass('new-project')[0].onclick();
      } else {
        ethos.showSignInModal();
      }
    }
  );

  setOnClick(
    eById('modal-submit-to-leaderboard'),
    () => {
      modal.close();
      showLeaderboard();
      leaderboard.submit(
        activeProjectAddress, 
        walletSigner, 
        () => {
          loadProjects();
        }
      )
    }
  );

  setOnClick(eByClass('keep-playing'), modal.close);

  setOnClick(eById('close-faucet'), () => {
    addClass(eById('faucet'), 'hidden')
  })

  setOnClick(eById('close-preapproval'), () => {
    addClass(eById('preapproval'), 'hidden')
  })
}

const onWalletConnected = async ({ signer }) => {
  walletSigner = signer;
  if (signer) {
    syncAccountState();

    modal.close();
  
    addClass(document.body, 'signed-in');

    // const response = await ethos.sign({ signer: walletSigner, signData: "YO" });
    // console.log("SIGN", response);
    
    const prepMint = async () => {
      const mint = eById('mint-project');
      const mintButtonTitle = "Mint New Project";
      if (mint.innerHTML.indexOf(mintButtonTitle) === -1) {
        const mintButton = document.createElement("BUTTON");
        setOnClick(
          mintButton,
          async () => {
            modal.open('loading', 'container');

            const details = {
              network: 'sui',
              address: contractAddress,
              moduleName: 'talentOnChain',
              functionName: 'create',
              inputValues: [],
              gasBudget: 5000
            };

            try {
              const data = await ethos.transact({
                signer: walletSigner, 
                details
              })

              if (!data) {
                modal.open('create-error', 'container');
                return;
              }

              const projectData = data.effects.events.find(
                e => e.moveEvent
              ).moveEvent.fields;
              //const { board_spaces, score } = gameData;
              const project = {
                address: data.effects.created[0].reference.objectId,
                boards: [
                  {
                    projectName
                  }
                ]
              }
              setActiveProject(project);
              ethos.hideWallet();
            } catch (e) {
              modal.open('create-error', 'container');
              return;
            }
          }
        );
        mintButton.innerHTML = mintButtonTitle;
        mint.appendChild(mintButton);
      }
    }

    prepMint();
    modal.open('loading', 'container');

    setOnClick(
      eByClass('new-project'),
      async () => {
        modal.open('mint', 'container');
      }
    );
    
    await loadProjects();

    if (!contentsInterval) {
      contentsInterval = setInterval(loadWalletContents, 3000)
    }

    if (projects.length === 0) {
      modal.open('mint', 'project', true);  
    } else {
      modal.close();

      if (projects.length === 1) {
        setActiveProject(projects[0]);
      } else {
        showLeaderboard();
      }
    }
    
    removeClass(document.body, 'signed-out');

    const address = await signer.getAddress();

    setOnClick(
      eById('copy-address'),
      () => {
        const innerHTML = eById('copy-address').innerHTML;
        eById('copy-address').innerHTML = "Copied!"
        navigator.clipboard.writeText(address)
        setTimeout(() => {
          eById('copy-address').innerHTML = innerHTML;
        }, 1000);
      }
    );
  } else {
    modal.open('get-started', 'project', true);
    setOnClick(eByClass('new-project'), ethos.showSignInModal)
    addClass(document.body, 'signed-out');
    removeClass(document.body, 'signed-in');
    addClass(eById('loading-projects'), 'hidden');
  }
}

window.requestAnimationFrame(init);