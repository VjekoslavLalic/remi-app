import { useState } from 'react';

export default function App() {
  const [step, setStep] = useState('setup'); 
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentShuffler, setCurrentShuffler] = useState(0);
  const [winnerIndex, setWinnerIndex] = useState(null);
  const [winnerType, setWinnerType] = useState(null);
  const [roundScores, setRoundScores] = useState({});
  const [roundNumber, setRoundNumber] = useState(1); // dodano praćenje runde
  const [gameWinner, setGameWinner] = useState(null); // za ekran kraja
  const [gameHistory, setGameHistory] = useState([]); // povijest igara
  const [showHistory, setShowHistory] = useState(false); // prikaz history page
  const [expandedGameIndex, setExpandedGameIndex] = useState(null); // koja igra je otvorena


  const startGame = () => {
    const initialPlayers = playerNames.map(name => ({ name, score: 0, lastRoundScore: 0 }));
    const shuffledIndex = Math.floor(Math.random() * initialPlayers.length);
    setCurrentShuffler(shuffledIndex);
    setPlayers(initialPlayers);
    setStep('game');
    setRoundNumber(1);
  };

  const applyRound = () => {
    if (winnerIndex === null || !winnerType) { alert('Select winner and type first!'); return; }
    const newPlayers = [...players];
    const winnerPoints = winnerType === 'hand' ? -100 : -40;
    newPlayers[winnerIndex].score += winnerPoints;
    newPlayers[winnerIndex].lastRoundScore = winnerPoints;

    newPlayers.forEach((p,i) => {
      if(i!==winnerIndex){
        const points = Number(roundScores[i])||0;
        p.score += points;
        p.lastRoundScore = points;
      }
    });

    setPlayers(newPlayers);
    setWinnerIndex(null);
    setWinnerType(null);
    setRoundScores({});
    setCurrentShuffler(prev => (prev===0?newPlayers.length-1:prev-1));
    setRoundNumber(prev=>prev+1);
  };

  const endGame = () => {
  const winner = players.reduce((acc, p, i) => (p.score < acc.score ? {index:i, name:p.name, score:p.score}: acc), {index:0,name:players[0].name,score:players[0].score});
  setGameWinner(winner);

  // dohvat trenutnog datuma
  const today = new Date();
  const dateString = today.toLocaleDateString('hr-HR', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });

  // spremanje u povijest
  setGameHistory(prev => [...prev, {
    id: today.getTime(),
    date: dateString,
    winner: winner.name,
    players: [...players.map(p=>({name:p.name, score:p.score}))]
  }]);

  setStep('end');
};

if(showHistory){
  return (
    <div style={{padding:20}}>
      <h1 style={{textAlign:'center',marginBottom:15}}>Game History</h1>
      {gameHistory.length === 0 && <p style={{textAlign:'center'}}>No games played yet.</p>}
      {gameHistory.map((game,i)=>(
        <div key={game.id} style={{marginBottom:10,border:'1px solid #ccc',borderRadius:6,padding:10}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight:'bold'}}>{game.date}</span>
            <button onClick={()=>setExpandedGameIndex(expandedGameIndex===i?null:i)}
              style={{padding:4,fontSize:12,borderRadius:4,border:'none',backgroundColor:'#ccc'}}>
              {expandedGameIndex===i ? 'Hide' : 'Show'}
            </button>
          </div>
          {expandedGameIndex===i && (
            <div style={{marginTop:6,paddingLeft:10}}>
              <p><strong>Winner:</strong> {game.winner}</p>
              {game.players.map((p,j)=>(
                <p key={j} style={{fontSize:14}}>{p.name}: {p.score} points</p>
              ))}
            </div>
          )}
        </div>
      ))}
      <button onClick={()=>setShowHistory(false)} style={{
        padding:10,fontSize:16,borderRadius:8,backgroundColor:'#ff6b6b',color:'#fff',
        border:'none',width:'50%',fontWeight:'bold',marginTop:20
      }}>Back</button>
    </div>
  )
}

  // ---------- Setup Screen ----------
  if(step==='setup'){
    return (
      <div style={{
        padding:15,
        display:'flex',
        flexDirection:'column',
        justifyContent:'center',
        alignItems:'center',
        height:'100vh',
        background:'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'
      }}>
        {/* History button ispod naslova */}

        <h1 style={{marginBottom:30,color:'',fontSize:60,fontWeight:'bold'}}>REMI</h1>
        <button onClick={()=>setShowHistory(true)} style={{
  marginBottom:15,
  padding:'8px 16px',
  fontSize:14,
  borderRadius:6,
  backgroundColor:'#8e44ad', // tamnija ljubičasta
  color:'#fff',
  border:'none',
  fontWeight:'bold',
  boxShadow:'0 2px 4px rgba(0,0,0,0.2)',
  cursor:'pointer',
  transition:'transform 0.1s, box-shadow 0.1s'
}}
onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow='0 4px 6px rgba(0,0,0,0.3)';}}
onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.boxShadow='0 2px 4px rgba(0,0,0,0.2)';}}
>History</button>
        <select value={numPlayers} onChange={(e)=>setNumPlayers(Number(e.target.value))} 
          style={{width:'80%',padding:8,fontSize:14,marginBottom:8,borderRadius:6,border:'none',background:'#f0f0f0',color:'black'}}>
          {[2,3,4,5,6].map(n=><option key={n} value={n}>{n} Players</option>)}
        </select>

        {[...Array(numPlayers)].map((_,i)=>(
          <input key={i} placeholder={`Player ${i+1} Name`} value={playerNames[i]||''} 
            onChange={(e)=>{const n=[...playerNames];n[i]=e.target.value;setPlayerNames(n)}} 
            style={{width:'80%',padding:8,fontSize:14,marginBottom:6,borderRadius:6,border:'none',background:'#f0f0f0',color:'black' }}/>
        ))}

        <button onClick={startGame} style={{
          marginTop:10,padding:10,fontSize:16,borderRadius:8,backgroundColor:'#ff6b6b',color:'#fff',
          border:'none',width:'80%',fontWeight:'bold',boxShadow:'0 4px 6px rgba(0,0,0,0.2)'
        }}>Start Game</button>
      </div>
    )
  }

  // ---------- End Screen ----------
  if(step==='end'){
  // sortiramo sve igrače po bodovima (najmanje prvo)
  const sortedPlayers = [...players].sort((a,b)=>a.score - b.score);

  return (
    <div style={{
      display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center',
      height:'100vh', background:'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
      color:'#fff', textAlign:'center', padding:20
    }}>
      <h1 style={{fontSize:24,fontWeight:'bold',marginBottom:10}}>Pobjednik je:</h1>
      <h2 style={{fontSize:28,fontWeight:'bold',marginBottom:20}}>{gameWinner.name}</h2>

      {/* Lista svih igrača */}
      <div style={{marginTop:10, width:'80%'}}>
        {sortedPlayers.map((p,i)=>(
          <p key={i} style={{
            fontSize:i===0 ? 22 : 14,
            fontWeight:i===0 ? 'bold' : 'normal',
            margin:3
          }}>
            {i+1}. {p.name} - {p.score} poena
          </p>
        ))}
      </div>

      {/* Back - resetira sve */}
      

      {/* Cancel - vraća u igru */}
      <button onClick={()=>{
        setStep('game'); // samo se vraćamo u igru
        setGameWinner(null); // maknemo end screen
      }} style={{
        padding:12,fontSize:16,borderRadius:8,backgroundColor:'#999',color:'#fff',
        border:'none',width:'60%',fontWeight:'bold',boxShadow:'0 4px 6px rgba(0,0,0,0.2)',
        marginTop:30
      }}>Cancel</button>
      <button onClick={()=>{
        setStep('setup');
        setPlayerNames([]);
        setPlayers([]);
        setCurrentShuffler(0);
        setWinnerIndex(null);
        setWinnerType(null);
        setRoundScores({});
        setRoundNumber(1);
        setGameWinner(null);
      }} style={{
        padding:12,fontSize:16,borderRadius:8,backgroundColor:'#ff6b6b',color:'#fff',
        border:'none',width:'60%',fontWeight:'bold',boxShadow:'0 4px 6px rgba(0,0,0,0.2)',
        marginTop:10
      }}>Home</button>
    </div>
  )
}

  // ---------- Game Screen ----------
  return (
    <div style={{
      padding:5,
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      minHeight:'100vh',
      background:'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'
    }}>
      <h1 style={{margin:3,color:'#fff',fontSize:22,fontWeight:'bold'}}>REMI Game</h1>
      <h2 style={{margin:2,color:'#f0f0f0',fontSize:14}}>
        Shuffler: {players[currentShuffler].name} | Round: {roundNumber}
      </h2>

      {/* Grid 2 po redu */}
      <div style={{
        display:'flex',
        flexWrap:'wrap',
        justifyContent:'space-between',
        width:'100%',
        marginTop:8,
        boxSizing:'border-box'
      }}>
        {players.map((p,i)=>( 
          <div key={i} style={{
            flex:'0 0 49%', 
            boxSizing:'border-box',
            marginBottom:8,
            background:'#fff',
            borderRadius:10,
            padding:8,
            display:'flex',
            flexDirection:'column',
            justifyContent:'space-between',
            height:160,
            overflow:'hidden',
            boxShadow:'0 2px 6px rgba(0,0,0,0.2)',
            transition:'transform 0.2s'
          }}>
            <div style={{display:'flex', justifyContent:'space-between', width:'100%', marginBottom:8}}>
              <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', gap:2, flex:'0 0 45%'}}>
                <h3 style={{margin:0,fontSize:18,fontWeight:'bold'}}>{p.name}</h3>
                <p style={{margin:0,fontSize:18}}>Total: {p.score}</p>
                <p style={{margin:0,fontSize:18}}>Last: {p.lastRoundScore}</p>
              </div>

              <div style={{display:'flex', flexDirection:'column', gap:6, flex:'0 0 50%', alignItems:'center', justifyContent:'center'}}>
                <button style={{
                  padding:14,borderRadius:6,border:'none',width:'80%',
                  backgroundColor:winnerIndex===i&&winnerType==='normal'?'#4caf50':'#c8e6c9',
                  fontWeight:'bold',fontSize:16,color:'#000'
                }} onClick={()=>{setWinnerIndex(i);setWinnerType('normal')}}>-40</button>

                <button style={{
                  padding:14,borderRadius:6,border:'none',width:'80%',
                  backgroundColor:winnerIndex===i&&winnerType==='hand'?'#f44336':'#ffcdd2',
                  fontWeight:'bold',fontSize:16,color:'#000'
                }} onClick={()=>{setWinnerIndex(i);setWinnerType('hand')}}>-100</button>
              </div>
            </div>

            {i!==winnerIndex && (
              <input type="number" placeholder="Score" value={roundScores[i]||''} 
                onChange={(e)=>setRoundScores({...roundScores,[i]:e.target.value})} 
                style={{
                  width:'100%',
                  padding:10,
                  borderRadius:6,
                  border:'1px solid #ccc',
                  fontSize:16,
                  textAlign:'center',
                  boxSizing:'border-box'
                }}
              />
            )}
          </div>
        ))}
      </div>

      <button onClick={applyRound} style={{
        marginTop:15,padding:8,fontSize:14,borderRadius:8,backgroundColor:'#4caf50',color:'#fff',
        border:'none',width:'90%',fontWeight:'bold',boxShadow:'0 4px 6px rgba(0,0,0,0.2)'
      }}>Apply Round</button>

      {/* End Game button */}
      <button onClick={endGame} style={{
        marginTop:15,padding:8,fontSize:14,borderRadius:8,backgroundColor:'#ff6b6b',color:'#fff',
        border:'none',width:'90%',fontWeight:'bold',boxShadow:'0 4px 6px rgba(0,0,0,0.2)'
      }}>End Game</button>
    </div>
  )
}