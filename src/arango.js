import { Database, aql } from 'arangojs'
import { log, warn, error, Verbose } from './services.js'
import conf, { revealConf } from './conf.js'

const verbose = Verbose('sd:arango'); verbose('')

async function startArango () {
  verbose('startArango')
  try {
    const dbInit = new Database(conf.arangodb.url)
    await dbInit.createDatabase(conf.arangodb.database)
    log('Database created:', conf.arangodb.database)
  } catch (err) {
    error('arango create db err:', err.message)
  }

  let db = null
  try {
    db = new Database({
      url: conf.arangodb.url,
      databaseName: conf.arangodb.database,
      auth: {
        username: conf.arangodb.auth.username,
        password: conf.arangodb.auth.password,
      },
    })
    log('Connected to Database')
  } catch (err) {
    error('arango connect to db err:', err.message)
  }

  const Pokemons = db.collection("my-pokemons")
  try {
    await Pokemons.create()
    log('Collection created')
  } catch (err) {
    error('arango create collection err:', err.message)
  }

  try {
    const doc = {
      type: 'fire',
      a: 'foo',
      b: 'bar',
      c: Date()
    }

    let meta = await Pokemons.save(doc)
    verbose('Arango document saved:', meta._rev)

    const pokemons = await db.query(aql`
      FOR pokemon IN ${Pokemons}
      FILTER pokemon.type == "fire"
      RETURN pokemon
    `)
    const allPokemons = await pokemons.all()
    verbose("allPokemans:", allPokemons)
    // for (let pokemon of allPokemons) {
    //   verbose('pokemon:', pokemon)
    // }
  } catch (err) {
    error('arango main err:', err.message)
  }
}

if (conf.arangodb.enable) {
  startArango()
}
