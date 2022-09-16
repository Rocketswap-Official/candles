import { Entity, Column, BaseEntity, PrimaryGeneratedColumn, PrimaryColumn } from "typeorm";
import { I_OhlcData, T_Resolution } from "../types";


@Entity()
export class CandleEntity extends BaseEntity implements I_OhlcData {
    @PrimaryColumn()
    id: string;

    @Column()
    contract_name: string;

    @Column()
    resolution: T_Resolution

    @Column()
    epoch: number

    @Column()
    time: number

    @Column()
    open: number

    @Column()
    close: number

    @Column()
    high: number

    @Column()
    low: number

    @Column()
    volume: number = 0

    @Column({ nullable: true })
    last?: number
}

export const constructCandleId = (contract_name: string, timeframe: T_Resolution, epoch: number) => `${contract_name}-${timeframe}-${epoch}`