use anchor_lang::prelude::*;

declare_id!("F1k3zJSy6gqFUY3CTv3HZeJ9S6QkeEnctcPiKaLKc96U");

#[program]
pub mod solana_twitter {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
