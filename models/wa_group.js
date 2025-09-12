import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Field from './field.model.js'

const WAGroup = sequelize.define('wa_group', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    field_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Field,
            key: 'field_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    target: {
        type: DataTypes.STRING,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('info', 'leak', 'report'),
        allowNull: false
    },
    group_name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'wa_group',
    timestamps: false,
    underscored: true
})

export default WAGroup
