import { Entity, Column, BaseEntity, PrimaryColumn } from "typeorm";


@Entity()
export class CandleMetaEntity extends BaseEntity {
    @PrimaryColumn()
    contract_name: string;

    @Column()
    precision: number;
}