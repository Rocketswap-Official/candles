import { Entity, Column, BaseEntity, PrimaryGeneratedColumn } from "typeorm";
import { I_OhlcData, T_Resolution } from "../types";


@Entity()
export class CandleEntity extends BaseEntity implements I_OhlcData {
    @PrimaryGeneratedColumn()
    id: number;

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
}