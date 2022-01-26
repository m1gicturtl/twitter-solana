import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SolanaTwitter } from '../target/types/solana_twitter';
import * as assert from "assert";
import * as bs58 from "bs58";

describe('solana_twitter', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.SolanaTwitter as Program<SolanaTwitter>;

  it('can send a new tweet', async () => {
    // Before sending the transaction to the blockchain.
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet('solana', '$sol @ $40 is probably a decent buy', {
        accounts: {
            tweet: tweet.publicKey,
            author: program.provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
    });

    // After sending the transaction to the blockchain.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);
    
    //Make sure it has the right data
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'solana');
    assert.equal(tweetAccount.content, '$sol @ $40 is probably a decent buy');
    assert.ok(tweetAccount.timestamp);
  });

  it('can send a new tweet without a topic', async () => {
    // Call the "SendTweet" instruction.
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet('', 'gm', {
        accounts: {
            tweet: tweet.publicKey,
            author: program.provider.wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet],
    });

    // Fetch the account details of the created tweet.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    // Ensure it has the right data.
    assert.equal(tweetAccount.author.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.equal(tweetAccount.topic, '');
    assert.equal(tweetAccount.content, 'gm');
    assert.ok(tweetAccount.timestamp);
  });

  it('can send a new tweet from a different author', async () => {
    // Generates another user and airdops then some SOL
    const otherUser = anchor.web3.Keypair.generate();
    const signature = await program.provider.connection.requestAirdrop(otherUser.publicKey, 1000000000);
    await program.provider.connection.confirmTransaction(signature);

    // Call the "SendTweet" instruction.
    const tweet = anchor.web3.Keypair.generate();
    await program.rpc.sendTweet('solana', 'otherUserTweet gm', {
        accounts: {
            tweet: tweet.publicKey,
            author: otherUser.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [tweet, otherUser],
    });

    // Fetch the account details of the created tweet.
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey);

    // Ensure it has the right data.
    assert.equal(tweetAccount.author.toBase58(), otherUser.publicKey.toBase58());
    assert.equal(tweetAccount.topic, 'solana');
    assert.equal(tweetAccount.content, 'otherUserTweet gm');
    assert.ok(tweetAccount.timestamp);
  });

  it('cannot provide a topic with more than 50 characters', async () => {
    try {
        const tweet = anchor.web3.Keypair.generate();
        const topicWith51Chars = 'x'.repeat(51);
        await program.rpc.sendTweet(topicWith51Chars, 'Comes with an invalid topic :O', {
            accounts: {
                tweet: tweet.publicKey,
                author: program.provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [tweet],
            });
        } catch (error) {
            assert.equal(error.msg, 'The provided topic should be 50 characters long at most.');
            return;
        }

        assert.fail('The instruction should have failed with a 51 chars topic');
    }); 

    it('cannot provide a content with more than 280 characters', async () => {
        try {
            const tweet = anchor.web3.Keypair.generate();
            const contentWith281Chars = 'x'.repeat(281);
            await program.rpc.sendTweet('Comes with an invalid content :O', contentWith281Chars, {
                accounts: {
                    tweet: tweet.publicKey,
                    author: program.provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                },
                signers: [tweet],
                });
        } catch (error) {
            assert.equal(error.msg, 'The provided content should be 280 characters long at most.');
            return;
        }
    
            assert.fail('The instruction should have failed with a 281 chars content');
    });
    
    it('can fetch all tweets', async () => {
        const tweetAccounts = await program.account.tweet.all();
        assert.equal(tweetAccounts.length, 3);
    });

    it('can filter tweets by author', async () => {
        const authorPublicKey = program.provider.wallet.publicKey;
        const tweetAccounts = await program.account.tweet.all([
            {
                memcmp: {
                    offset: 8, //Discriminator, # of byte to start looking from onwards
                    bytes: authorPublicKey.toBase58(),
                }
            }
        ]);
        
        assert.equal(tweetAccounts.length, 2);
        assert.ok(tweetAccounts.every(tweetAccount => {
            return tweetAccount.account.author.toBase58() === authorPublicKey.toBase58()
        }));
    });

    it('can filter tweets by topics', async () => {
        const tweetAccounts = await program.account.tweet.all([
            {
                memcmp: {
                    offset: 8 + // Discriminator.
                        32 + // Author public key.
                        8 + // Timestamp.
                        4, // Topic string prefix.
                    bytes: bs58.encode(Buffer.from('solana')),
                }
            }
        ]);
    
        assert.equal(tweetAccounts.length, 2);
        assert.ok(tweetAccounts.every(tweetAccount => {
            return tweetAccount.account.topic === 'solana'
        }))
    });

});